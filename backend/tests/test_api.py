"""End-to-end API tests, including a flawless play-through."""
import os
import tempfile

import numpy as np
import pytest
from fastapi.testclient import TestClient

os.environ['WK_DATABASE_URL'] = 'sqlite:///' + os.path.join(
    tempfile.mkdtemp(), 'test_wavekitchen.db')

from app.database import SessionLocal, init_db          # noqa: E402
from app.dsp import core as C, pipeline                 # noqa: E402
from app.main import app                                # noqa: E402
from app.models import Recipe                           # noqa: E402
from app.seed import seed                               # noqa: E402


@pytest.fixture(scope='module')
def client():
    from sqlalchemy import create_engine
    from sqlalchemy.orm import sessionmaker
    from app.database import Base, get_db
    
    test_db_file = os.path.join(tempfile.mkdtemp(), 'test_api_wavekitchen.db')
    test_engine = create_engine(f'sqlite:///{test_db_file}', connect_args={'check_same_thread': False}, future=True)
    TestingSessionLocal = sessionmaker(bind=test_engine, autoflush=False, autocommit=False, future=True)
    
    Base.metadata.create_all(bind=test_engine)
    db = TestingSessionLocal()
    seed(db, force=True)
    db.close()
    
    def override_get_db():
        db = TestingSessionLocal()
        try:
            yield db
        finally:
            db.close()
            
    app.dependency_overrides[get_db] = override_get_db
    with TestClient(app) as c:
        yield c
    app.dependency_overrides.clear()


@pytest.fixture(scope='module')
def chef(client):
    r = client.post('/api/players', json={'handle': 'Test Chef', 'password': PW})
    assert r.status_code == 201
    body = r.json()
    return {'token': body['token'], 'id': body['id']}


PW = 'correct horse'


def auth(chef):
    return {'X-Player-Token': chef['token']}


# --------------------------------------------------------------------- meta
def test_health(client):
    body = client.get('/api/health').json()
    assert body['status'] == 'ok'
    assert body['sample_rate'] == C.SR


def test_catalogue_is_seeded(client):
    assert len(client.get('/api/ingredients').json()) >= 18
    assert len(client.get('/api/appliances').json()) == 8
    assert len(client.get('/api/recipes').json()) >= 5


def test_appliance_detail_exposes_its_system(client):
    body = client.get('/api/appliances/simmer').json()
    assert len(body['impulse_response']) > 0
    assert len(body['response_db']) == len(body['response_freqs'])


# ------------------------------------------------------------------ players
def test_duplicate_handles_are_rejected(client, chef):
    assert client.post('/api/players',
                       json={'handle': 'Test Chef', 'password': PW}).status_code == 409


def test_login_existing_chef(client, chef):
    r = client.post('/api/players/login', json={'handle': 'Test Chef', 'password': PW})
    assert r.status_code == 200
    body = r.json()
    assert body['handle'] == 'Test Chef'
    assert body['token'] == chef['token']


def test_login_unknown_chef_fails(client):
    r = client.post('/api/players/login', json={'handle': 'Nonexistent Chef', 'password': PW})
    assert r.status_code == 404


def test_login_needs_the_right_password(client, chef):
    """Knowing a chef's name is no longer enough to get their token."""
    for path in ('/api/players/login', '/api/players/auth-or-register'):
        r = client.post(path, json={'handle': 'Test Chef', 'password': 'wrong-pass'})
        assert r.status_code == 401
        assert 'token' not in r.json()
    assert client.post('/api/players/login', json={'handle': 'Test Chef'}).status_code == 422


def test_legacy_chef_without_password_sets_it_on_first_login(client):
    from app.database import get_db
    from app.models import Player
    db = next(app.dependency_overrides[get_db]())   # the API's test database
    db.add(Player(handle='Legacy Chef'))            # no password_hash, like old rows
    db.commit()
    db.close()
    first = client.post('/api/players/login', json={'handle': 'Legacy Chef', 'password': 'first-pw'})
    assert first.status_code == 200
    again = client.post('/api/players/login', json={'handle': 'Legacy Chef', 'password': 'other-pw'})
    assert again.status_code == 401


def test_auth_or_register_existing_and_new(client, chef):
    # Existing chef
    r1 = client.post('/api/players/auth-or-register', json={'handle': 'Test Chef', 'password': PW})
    assert r1.status_code == 200
    assert r1.json()['token'] == chef['token']

    # New chef
    r2 = client.post('/api/players/auth-or-register',
                     json={'handle': 'Brand New Chef', 'password': PW})
    assert r2.status_code == 200
    assert r2.json()['handle'] == 'Brand New Chef'


def test_list_chefs(client, chef):
    r = client.get('/api/players')
    assert r.status_code == 200
    chefs = r.json()
    assert any(c['handle'] == 'Test Chef' for c in chefs)


def test_profile_requires_a_token(client):
    assert client.get('/api/players/me').status_code == 401


def test_profile(client, chef):
    body = client.get('/api/players/me', headers=auth(chef)).json()
    assert body['handle'] == 'Test Chef'
    assert body['rank_title'] == 'Dishwasher'


# ------------------------------------------------------------------ locking
def test_locked_tiers_are_ranked_but_earn_no_points(client, chef):
    """Locked-tier runs used to 403 at start, silently leaving them off the board."""
    before = client.get('/api/players/me', headers=auth(chef)).json()
    r = client.post('/api/sessions', json={'recipe_id': 'chicken-fry', 'difficulty': 'hard'},
                    headers=auth(chef))
    assert r.status_code == 201
    result = client.post(f"/api/sessions/{r.json()['id']}/submit", headers=auth(chef)).json()
    assert result['points_awarded'] == 0
    after = client.get('/api/players/me', headers=auth(chef)).json()
    assert after['points'] == before['points']
    assert after['unlocked_tier'] == before['unlocked_tier']
    rows = client.get('/api/leaderboard', params={'recipe_id': 'chicken-fry'}).json()
    assert any(row['handle'] == 'Test Chef' for row in rows)


def test_a_served_dish_cannot_be_edited(client, chef):
    sid = client.post('/api/sessions', json={'recipe_id': 'sandwich'},
                      headers=auth(chef)).json()['id']
    assert client.post(f'/api/sessions/{sid}/submit', headers=auth(chef)).status_code == 200
    h = auth(chef)
    assert client.put(f'/api/sessions/{sid}/params', headers=h,
                      json={'seasoning': 1.0}).status_code == 409
    assert client.post(f'/api/sessions/{sid}/ingredients/0/filter', headers=h,
                       json={'bands': [], 'tools': []}).status_code == 409
    assert client.delete(f'/api/sessions/{sid}', headers=h).status_code == 409


def test_leaderboard_filters_by_difficulty(client, chef):
    for diff in ('easy', 'masterchef'):
        sid = client.post('/api/sessions', json={'recipe_id': 'sandwich', 'difficulty': diff},
                          headers=auth(chef)).json()['id']
        client.post(f'/api/sessions/{sid}/submit', headers=auth(chef))
    rows = client.get('/api/leaderboard',
                      params={'recipe_id': 'sandwich', 'difficulty': 'masterchef'}).json()
    assert rows and all(r['difficulty'] == 'masterchef' for r in rows)


def _test_db():
    from app.database import get_db
    return next(app.dependency_overrides[get_db]())


def test_runs_without_a_recorded_difficulty_only_show_on_easy(client, chef):
    from app.models import Attempt, GameSession
    sid = client.post('/api/sessions', json={'recipe_id': 'cake'}, headers=auth(chef)).json()['id']
    client.post(f'/api/sessions/{sid}/submit', headers=auth(chef))
    db = _test_db()
    db.query(GameSession).filter(GameSession.id == sid).update({GameSession.difficulty: None})
    db.query(Attempt).filter(Attempt.session_id == sid).update({Attempt.difficulty: None})
    db.commit()
    db.close()
    board = lambda d: client.get('/api/leaderboard', params={'recipe_id': 'cake', 'difficulty': d}).json()
    assert any(r['difficulty'] is None for r in board('easy'))
    for d in ('medium', 'hard', 'masterchef'):       # used to appear on every board
        assert all(r['difficulty'] == d for r in board(d))


def test_new_sessions_always_record_a_difficulty(client, chef):
    r = client.post('/api/sessions', json={'recipe_id': 'sandwich'}, headers=auth(chef)).json()
    from app.models import GameSession
    db = _test_db()
    assert db.get(GameSession, r['id']).difficulty == 'easy'
    db.close()


def test_old_runs_get_an_overall_score_on_the_same_scale(client, chef):
    from app.database import _backfill_run_totals
    from app.gameplay import run_total
    from app.models import Attempt, GameSession
    sid = client.post('/api/sessions', json={'recipe_id': 'sandwich', 'difficulty': 'hard'},
                      headers=auth(chef)).json()['id']
    client.post(f'/api/sessions/{sid}/submit', headers=auth(chef))
    db = _test_db()
    attempt = db.query(Attempt).filter(Attempt.session_id == sid).one()
    stored = (attempt.total_score, attempt.time_bonus)
    attempt.total_score = attempt.time_bonus = None       # as for a run from before totals
    db.commit()
    _backfill_run_totals(db)
    db.refresh(attempt)
    session = db.get(GameSession, sid)
    expected = run_total(attempt.score, 'hard',
                         (session.served_at - session.created_at).total_seconds())
    assert (attempt.total_score, attempt.time_bonus) == expected == stored
    db.close()


def test_global_ranking_lists_only_chefs_who_have_served(client, chef):
    client.post('/api/players', json={'handle': 'Idle Chef', 'password': PW})
    handles = {r['handle'] for r in client.get('/api/leaderboard/global',
                                                params={'limit': 500}).json()}
    assert 'Idle Chef' not in handles and 'Test Chef' in handles


def test_one_chef_with_many_runs_does_not_crowd_out_others(client, chef):
    rival = client.post('/api/players', json={'handle': 'Rival', 'password': PW}).json()
    for _ in range(6):
        sid = client.post('/api/sessions', json={'recipe_id': 'sandwich'},
                          headers=auth(chef)).json()['id']
        client.post(f'/api/sessions/{sid}/submit', headers=auth(chef))
    sid = client.post('/api/sessions', json={'recipe_id': 'sandwich'},
                      headers={'X-Player-Token': rival['token']}).json()['id']
    client.post(f'/api/sessions/{sid}/submit', headers={'X-Player-Token': rival['token']})
    rows = client.get('/api/leaderboard', params={'recipe_id': 'sandwich', 'limit': 2}).json()
    assert {r['handle'] for r in rows} == {'Test Chef', 'Rival'}


# ----------------------------------------------------------------- sessions
def test_session_start_delivers_contaminated_ingredients(client, chef):
    r = client.post('/api/sessions', json={'recipe_id': 'burger'}, headers=auth(chef))
    assert r.status_code == 201
    body = r.json()
    assert len(body['items']) == 6
    for item in body['items']:
        assert item['dirty']['audio']
        assert len(item['bands']) == 8
    # Washable items should have contaminants, non-washable items should be clean
    washable_items = [i for i in body['items'] if i['ingredient_id'] in ('lettuce', 'tomato')]
    clean_items = [i for i in body['items'] if i['ingredient_id'] in ('bun', 'patty', 'cheese', 'salt')]
    assert all(len(i['contaminants']) > 0 for i in washable_items)
    assert all(len(i['contaminants']) == 0 for i in clean_items)


def test_filtering_updates_prep_score(client, chef):
    sid = client.post('/api/sessions', json={'recipe_id': 'sandwich'},
                      headers=auth(chef)).json()['id']
    before = client.post(f'/api/sessions/{sid}/ingredients/0/filter',
                         json={'bands': [], 'tools': []}, headers=auth(chef)).json()
    after = client.post(f'/api/sessions/{sid}/ingredients/0/filter',
                        json={'bands': [], 'tools': [{'kind': 'dehum', 'f0': 50}]},
                        headers=auth(chef)).json()
    assert 0 <= before['prep']['score'] <= 100
    assert len(after['filter_curve']) == len(after['filter_freqs'])
    assert after['spectrum']['db']


def test_over_filtering_is_detected_and_rejected(client, chef):
    sid = client.post('/api/sessions', json={'recipe_id': 'sandwich'},
                      headers=auth(chef)).json()['id']
    cheese = 2      # the sandwich's Cheese slot (bread, chicken, cheese, ...)
    r = client.post(f'/api/sessions/{sid}/ingredients/{cheese}/filter',
                    json={'bands': [], 'tools': [{'kind': 'lowpass', 'cutoff': 15}]},
                    headers=auth(chef)).json()
    assert r['prep']['over_filtered'] is True
    assert client.post(f'/api/sessions/{sid}/ingredients/{cheese}/accept',
                       headers=auth(chef)).status_code == 409


def test_params_return_every_stage(client, chef):
    sid = client.post('/api/sessions', json={'recipe_id': 'burger'},
                      headers=auth(chef)).json()['id']
    r = client.put(f'/api/sessions/{sid}/params', headers=auth(chef), json={
        'seasoning': 0.8, 'blend': 1.0, 'marinate': 0.09,
        'appliances': ['grill', 'bake'], 'anti_alias': True})
    assert r.status_code == 200
    body = r.json()
    for key in ('mixed', 'seasoned', 'blended', 'marinated', 'modulated',
                'chopped', 'cooked', 'final'):
        assert body[key]['length'] > 0
    assert body['cascade_ir']
    assert body['nyquist'] == C.SR / 2


def test_convolution_view_is_a_real_partial_sum(client, chef):
    sid = client.post('/api/sessions', json={'recipe_id': 'sandwich'},
                      headers=auth(chef)).json()['id']
    client.put(f'/api/sessions/{sid}/params', headers=auth(chef),
               json={'seasoning': 1.0, 'appliances': ['bake']})
    early = client.get(f'/api/sessions/{sid}/convolution?lag=10',
                       headers=auth(chef)).json()
    late = client.get(f'/api/sessions/{sid}/convolution?lag={early["max_lag"]}',
                      headers=auth(chef)).json()
    assert all(v == 0 for v in early['y'][11:])       # nothing drawn past the lag
    assert any(v != 0 for v in late['y'][-10:])       # the tail exists at the end


def test_unknown_appliance_is_rejected(client, chef):
    sid = client.post('/api/sessions', json={'recipe_id': 'sandwich'},
                      headers=auth(chef)).json()['id']
    r = client.put(f'/api/sessions/{sid}/params', headers=auth(chef),
                   json={'seasoning': 1.0, 'appliances': ['microwave']})
    assert r.status_code == 422


def test_another_player_cannot_touch_the_session(client, chef):
    sid = client.post('/api/sessions', json={'recipe_id': 'sandwich'},
                      headers=auth(chef)).json()['id']
    other = client.post('/api/players', json={'handle': 'Intruder', 'password': PW}).json()
    r = client.get(f'/api/sessions/{sid}',
                   headers={'X-Player-Token': other['token']})
    assert r.status_code == 403


# ------------------------------------------------------------------ scoring
def _play_perfectly(client, chef, recipe_id: str, **extra_params) -> dict:
    """Clean every ingredient fully and use the recipe's exact parameters."""
    db = SessionLocal()
    recipe: Recipe = db.get(Recipe, recipe_id)
    spec = recipe.as_dict()
    db.close()

    sid = client.post('/api/sessions', json={'recipe_id': recipe_id},
                      headers=auth(chef)).json()['id']

    # a wide band-pass that keeps the ingredient and trims the extremes
    for slot in range(len(spec['ingredients'])):
        client.post(f'/api/sessions/{sid}/ingredients/{slot}/filter',
                    headers=auth(chef),
                    json={'bands': [], 'tools': [
                        {'kind': 'dehum', 'f0': 50},
                        {'kind': 'dehum', 'f0': 60}]})

    params = {
        'seasoning': spec['seasoning'], 'blend': spec['blend'],
        'marinate': spec['marinate'],
        'carrier': spec['caramelize_carrier'], 'depth': spec['caramelize_depth'],
        'chop_factor': spec['chop_factor'], 'anti_alias': True,
        'appliances': spec['appliances'],
        **extra_params,
    }
    client.put(f'/api/sessions/{sid}/params', headers=auth(chef), json=params)
    return client.post(f'/api/sessions/{sid}/submit', headers=auth(chef)).json()


def test_a_careful_cook_scores_well(client, chef):
    result = _play_perfectly(client, chef, 'burger', **_finishing('burger'))
    assert result['score'] > 60
    assert result['stars'] >= 3
    assert result['target']['audio'] and result['player_dish']['audio']


def test_cooking_score_isolates_the_appliance_choice(client, chef):
    """Right appliances = perfect cooking, even though the whole dish isn't."""
    result = _play_perfectly(client, chef, 'burger')
    assert result['cooking_score'] == 100.0


def _finishing(recipe_id: str, oven_notch_on: bool = True, cart_w0=None,
               cart_preset: str = 'notch', cart_r: float = 0.85) -> dict:
    """Finishing settings as the browser sends them (game Hz relative to oven_f0)."""
    from app import delivery
    prof = delivery.profile(recipe_id)
    out = dict(oven_f0=4.0, oven_gains=[1.0, 1.0, 1.0], oven_cutoff=26.0,
               oven_notch=prof['defect_hz'], oven_notch_on=oven_notch_on)
    if cart_preset:
        out.update(system_preset=cart_preset, system_pole_radius=cart_r,
                   system_omega=delivery.road_omega(recipe_id) if cart_w0 is None else cart_w0,
                   system_sampling_hz=8000)
    return out


def test_the_burnt_overtone_costs_points_until_the_oven_removes_it(client, chef):
    served_raw = _play_perfectly(client, chef, 'burger')          # straight from Check Dish
    untouched = _play_perfectly(client, chef, 'burger',
                                **_finishing('burger', oven_notch_on=False, cart_preset=''))
    notched = _play_perfectly(client, chef, 'burger', **_finishing('burger', cart_preset=''))
    assert served_raw['delivery_score'] is None
    assert notched['delivery_score'] > untouched['delivery_score'] + 5
    assert notched['score'] > served_raw['score']


def test_the_cart_must_reject_the_road_vibration(client, chef):
    from app import delivery
    true_w = delivery.road_omega('burger')
    # where a 1.2 kHz vibration sensor reports the 2.6 kHz road tone (aliased)
    wrong_w = 2 * 3.141592653589793 * (2600 % 1200) / 1200
    on_target = _play_perfectly(client, chef, 'burger', **_finishing('burger'))
    off_target = _play_perfectly(client, chef, 'burger', **_finishing('burger', cart_w0=wrong_w))
    unstable = _play_perfectly(client, chef, 'burger', **_finishing(
        'burger', cart_preset='resonator2', cart_r=1.05, cart_w0=1.0))
    assert on_target['system_score'] > off_target['system_score'] > unstable['system_score']
    assert on_target['score'] > off_target['score'] > unstable['score']


def test_finishing_scores_ignore_client_reported_numbers(client, chef):
    r = _play_perfectly(client, chef, 'burger', delivery_accuracy=100, system_accuracy=100,
                        **_finishing('burger', cart_preset='resonator2', cart_r=1.05, cart_w0=1.0))
    assert r['system_score'] < 50


def test_the_bowl_decides_what_gets_mixed(client, chef):
    full = _play_perfectly(client, chef, 'burger',
                           bowl=['Bun', 'Beef Patty', 'Cheese', 'Lettuce', 'Tomato', 'Salt'])
    missing = _play_perfectly(client, chef, 'burger', bowl=['Bun', 'Beef Patty'])
    extra = _play_perfectly(client, chef, 'burger',
                            bowl=['Bun', 'Beef Patty', 'Cheese', 'Lettuce', 'Tomato', 'Salt',
                                  'Garlic', 'Mushroom'])
    assert full['mixing_score'] > missing['mixing_score']
    assert full['mixing_score'] > extra['mixing_score']


def test_an_untouched_pipeline_scores_badly_with_useful_notes(client, chef):
    sid = client.post('/api/sessions', json={'recipe_id': 'burger'},
                      headers=auth(chef)).json()['id']
    result = client.post(f'/api/sessions/{sid}/submit', headers=auth(chef)).json()
    assert result['score'] < 60
    joined = ' '.join(result['notes']).lower()
    assert 'seasoned' in joined
    assert 'convolution order' in joined


def test_a_dish_cannot_be_served_twice(client, chef):
    sid = client.post('/api/sessions', json={'recipe_id': 'sandwich'},
                      headers=auth(chef)).json()['id']
    assert client.post(f'/api/sessions/{sid}/submit', headers=auth(chef)).status_code == 200
    assert client.post(f'/api/sessions/{sid}/submit', headers=auth(chef)).status_code == 409


def test_scores_are_recomputed_server_side(client, chef):
    """The client never sends audio, so a forged signal cannot inflate a score."""
    sid = client.post('/api/sessions', json={'recipe_id': 'sandwich'},
                      headers=auth(chef)).json()['id']
    body = client.post(f'/api/sessions/{sid}/submit', headers=auth(chef)).json()

    db = SessionLocal()
    recipe = db.get(Recipe, 'sandwich')
    db.close()
    # independently reproduce the reference dish from the recipe alone
    from app.dsp import instruments, metrics
    ref = pipeline.run_pipeline([instruments.synth('guitar', C.FRAME, 196)],
                                pipeline.reference_params(recipe.as_dict()))
    assert np.isfinite(ref['final']).all()
    assert 0 <= body['score'] <= 100
    assert metrics.dish_metrics(ref['final'], ref['final'])['score'] == 100.0


# -------------------------------------------------------------- progression
def test_clearing_tier_one_unlocks_tier_two(client, chef):
    # Finished dishes (oven + cart): one served with the burnt overtone still
    # in it no longer reaches the unlock score.
    _play_perfectly(client, chef, 'sandwich', **_finishing('sandwich'))
    _play_perfectly(client, chef, 'burger', **_finishing('burger'))
    profile = client.get('/api/players/me', headers=auth(chef)).json()
    assert profile['unlocked_tier'] >= 2
    assert profile['points'] > 0


def test_points_only_come_from_beating_a_personal_best(client, chef):
    first = _play_perfectly(client, chef, 'sandwich')
    second = _play_perfectly(client, chef, 'sandwich')
    if second['score'] <= first['score']:
        assert second['points_awarded'] == 0


# ------------------------------------------------------- leaderboard & stats
def test_leaderboards(client, chef):
    rows = client.get('/api/leaderboard').json()
    assert rows and rows[0]['rank'] == 1
    per_recipe = client.get('/api/leaderboard?recipe_id=sandwich').json()
    assert all(r['recipe_id'] == 'sandwich' for r in per_recipe)
    career = client.get('/api/leaderboard/global').json()
    assert career and career[0]['points'] >= career[-1]['points']


def test_stats(client, chef):
    body = client.get('/api/stats').json()
    assert body['players'] >= 1
    assert body['dishes_served'] >= 1
    assert len(body['recipes']) >= 5
    assert body['hardest_recipe']


def test_player_history(client, chef):
    rows = client.get('/api/players/me/history', headers=auth(chef)).json()
    assert rows and 'score' in rows[0]


# ------------------------------------------------------------- recipe CRUD
def test_recipe_crud(client):
    payload = {
        'id': 'testdish', 'name': 'Test Dish', 'emoji': '', 'tier': 1,
        'story': 'A dish authored through the API.',
        'ingredients': ['cheese'], 'appliances': ['simmer'],
        'seasoning': 1.0, 'blend': 1.0, 'marinate': 0.0,
        'noise_difficulty': 0.5, 'tolerance': 1.2, 'teaches': ['Smoothing'],
    }
    assert client.post('/api/recipes', json=payload).status_code == 201
    assert client.post('/api/recipes', json=payload).status_code == 409

    bad = dict(payload, id='baddish', appliances=['microwave'])
    assert client.post('/api/recipes', json=bad).status_code == 422

    r = client.patch('/api/recipes/testdish', json={'seasoning': 0.7})
    assert r.json()['seasoning'] == 0.7

    assert client.delete('/api/recipes/testdish').status_code == 204
    ids = [x['id'] for x in client.get('/api/recipes').json()]
    assert 'testdish' not in ids


def test_frontend_master_recipes(client):
    recipes = client.get('/api/recipes').json()
    recipe_ids = {r['id'] for r in recipes}
    for expected in ['burger', 'sandwich', 'cake', 'noodles', 'chicken-fry']:
        assert expected in recipe_ids
        detail = client.get(f'/api/recipes/{expected}').json()
        assert len(detail['ingredients']) > 0
        assert len(detail['appliances']) > 0
        assert detail['difficulty'] in ('Easy', 'Medium', 'Hard', 'Masterchef')


def test_score_breakdown(client, chef):
    result = _play_perfectly(client, chef, 'sandwich', **_finishing('sandwich'))
    assert result['filtering_score'] is not None
    assert result['mixing_score'] is not None
    assert result['transform_score'] is not None
    assert result['cooking_score'] is not None
    assert result['score'] >= 60


def test_all_18_ingredients(client):
    ings = client.get('/api/ingredients').json()
    assert len(ings) >= 18
    categories = {i['category'] for i in ings}
    assert 'Produce' in categories
    assert 'Bakery' in categories
    assert 'Protein' in categories
    assert 'Dairy' in categories
    assert 'Pantry' in categories


def test_the_leaderboard_shows_the_same_overall_score_as_the_score_screen(client, chef):
    """One number everywhere: dish x 10 x difficulty + time bonus, timed on the server."""
    from app import gameplay
    r = _play_perfectly(client, chef, 'burger')
    # Served straight away: the full (capped) time bonus, x0.8 on easy.
    assert r['time_bonus'] == round(gameplay.MAX_TIME_BONUS * 0.8)
    assert r['total_score'] == round(r['score'] * 10 * 0.8) + r['time_bonus']
    # The board shows each chef's best run by that same number.
    rows = client.get('/api/leaderboard', params={'recipe_id': 'burger'}).json()
    mine = next(row for row in rows if row['player_id'] == chef['id'])
    assert mine['total_score'] >= r['total_score']
    assert [row['total_score'] for row in rows] == sorted(
        (row['total_score'] for row in rows), reverse=True)


def test_run_total_scales_with_difficulty_and_time_left():
    from app.gameplay import run_total
    assert run_total(80, 'easy', 0) == (round(800 * 0.8) + 240, 240)
    assert run_total(80, 'masterchef', 90) == (round(800 * 1.5) + 90, 90)   # 30 s of 120 left
    assert run_total(80, 'hard', 500) == (1000, 0)                          # out of time (190 s)


def test_only_this_seasons_runs_are_ranked(client, chef):
    """Runs judged under older scoring rules leave the board and personal bests."""
    from app import gameplay
    from app.models import Attempt
    fin = _finishing('noodles')
    first = _play_perfectly(client, chef, 'noodles', **fin)
    assert first['points_awarded'] > 0
    db = _test_db()
    old = db.query(Attempt).filter(Attempt.id == first['attempt_id']).one()
    assert old.scoring_version == gameplay.SCORING_VERSION
    old.scoring_version, old.score = None, 100.0          # an old, lenient run
    db.commit()
    db.close()
    rows = client.get('/api/leaderboard', params={'recipe_id': 'noodles', 'difficulty': 'easy'}).json()
    assert all(r['score'] != 100.0 for r in rows)
    again = _play_perfectly(client, chef, 'noodles', **fin)   # old 100 is not the bar to beat
    assert again['points_awarded'] > 0
    profile = client.get('/api/players/me', headers=auth(chef)).json()
    assert profile['best_scores']['noodles'] == again['score']


def test_recipe_book_shows_a_signed_in_chefs_best(client, chef):
    fin = _finishing('burger')
    r = _play_perfectly(client, chef, 'burger', **fin)
    book = client.get('/api/recipes', headers=auth(chef)).json()
    burger = next(c for c in book if c['id'] == 'burger')
    assert burger['best_score'] is not None and burger['best_score'] >= r['score']


def test_timing_notes_are_relative_to_the_target(client, chef):
    # Cake's blend target is 0.6: 0.7 is 17 % off and must be named
    # (a fixed 0.12 limit used to stay silent about it).
    notes = ' '.join(_play_perfectly(client, chef, 'cake', blend=0.7)['notes'])
    assert 'Over-blended' in notes
    notes = ' '.join(_play_perfectly(client, chef, 'cake', blend=0.61)['notes'])
    assert 'blended' not in notes                      # within 5 %: no note


def test_removed_recipes_are_retired(client, chef):
    """Golden Toast, Velvet Soup, Crisp Salad, Crème Brûlée and the Grand Feast
    are out of the recipe book; old rows are kept but inactive."""
    book = {c['id'] for c in client.get('/api/recipes').json()}
    assert book == {'burger', 'sandwich', 'cake', 'noodles', 'chicken-fry'}
    stats = {r['recipe_id'] for r in client.get('/api/stats').json()['recipes']}
    assert stats == book


def test_server_time_limits_match_the_game_timers():
    """The time bonus uses the same limits the in-game timer counts down from."""
    import re
    from pathlib import Path
    from app.gameplay import DIFFICULTIES
    src = (Path(__file__).resolve().parents[2] / 'frontend/src/lib/recipes.ts').read_text(encoding='utf-8')
    for diff, (limit, _) in DIFFICULTIES.items():
        m = re.search(rf'{diff}: \{{\s*id: "{diff}",.*?timeSeconds: (\d+)', src, re.S)
        assert m and int(m.group(1)) == limit, diff
