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
    r = client.post('/api/players', json={'handle': 'Test Chef'})
    assert r.status_code == 201
    body = r.json()
    return {'token': body['token'], 'id': body['id']}


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
    assert client.post('/api/players', json={'handle': 'Test Chef'}).status_code == 409


def test_login_existing_chef(client, chef):
    r = client.post('/api/players/login', json={'handle': 'Test Chef'})
    assert r.status_code == 200
    body = r.json()
    assert body['handle'] == 'Test Chef'
    assert body['token'] == chef['token']


def test_login_unknown_chef_fails(client):
    r = client.post('/api/players/login', json={'handle': 'Nonexistent Chef'})
    assert r.status_code == 404


def test_auth_or_register_existing_and_new(client, chef):
    # Existing chef
    r1 = client.post('/api/players/auth-or-register', json={'handle': 'Test Chef'})
    assert r1.status_code == 200
    assert r1.json()['token'] == chef['token']

    # New chef
    r2 = client.post('/api/players/auth-or-register', json={'handle': 'Brand New Chef'})
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
def test_locked_tiers_cannot_be_started(client, chef):
    r = client.post('/api/sessions', json={'recipe_id': 'feast'}, headers=auth(chef))
    assert r.status_code == 403


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
    sid = client.post('/api/sessions', json={'recipe_id': 'toast'},
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
    sid = client.post('/api/sessions', json={'recipe_id': 'toast'},
                      headers=auth(chef)).json()['id']
    r = client.post(f'/api/sessions/{sid}/ingredients/0/filter',
                    json={'bands': [], 'tools': [{'kind': 'lowpass', 'cutoff': 15}]},
                    headers=auth(chef)).json()
    assert r['prep']['over_filtered'] is True
    assert client.post(f'/api/sessions/{sid}/ingredients/0/accept',
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
    sid = client.post('/api/sessions', json={'recipe_id': 'toast'},
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
    sid = client.post('/api/sessions', json={'recipe_id': 'toast'},
                      headers=auth(chef)).json()['id']
    r = client.put(f'/api/sessions/{sid}/params', headers=auth(chef),
                   json={'seasoning': 1.0, 'appliances': ['microwave']})
    assert r.status_code == 422


def test_another_player_cannot_touch_the_session(client, chef):
    sid = client.post('/api/sessions', json={'recipe_id': 'toast'},
                      headers=auth(chef)).json()['id']
    other = client.post('/api/players', json={'handle': 'Intruder'}).json()
    r = client.get(f'/api/sessions/{sid}',
                   headers={'X-Player-Token': other['token']})
    assert r.status_code == 403


# ------------------------------------------------------------------ scoring
def _play_perfectly(client, chef, recipe_id: str) -> dict:
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
    }
    client.put(f'/api/sessions/{sid}/params', headers=auth(chef), json=params)
    return client.post(f'/api/sessions/{sid}/submit', headers=auth(chef)).json()


def test_a_careful_cook_scores_well(client, chef):
    result = _play_perfectly(client, chef, 'burger')
    assert result['score'] > 60
    assert result['stars'] >= 3
    assert result['target']['audio'] and result['player_dish']['audio']


def test_an_untouched_pipeline_scores_badly_with_useful_notes(client, chef):
    sid = client.post('/api/sessions', json={'recipe_id': 'burger'},
                      headers=auth(chef)).json()['id']
    result = client.post(f'/api/sessions/{sid}/submit', headers=auth(chef)).json()
    assert result['score'] < 60
    joined = ' '.join(result['notes']).lower()
    assert 'seasoned' in joined
    assert 'convolution order' in joined


def test_a_dish_cannot_be_served_twice(client, chef):
    sid = client.post('/api/sessions', json={'recipe_id': 'toast'},
                      headers=auth(chef)).json()['id']
    assert client.post(f'/api/sessions/{sid}/submit', headers=auth(chef)).status_code == 200
    assert client.post(f'/api/sessions/{sid}/submit', headers=auth(chef)).status_code == 409


def test_scores_are_recomputed_server_side(client, chef):
    """The client never sends audio, so a forged signal cannot inflate a score."""
    sid = client.post('/api/sessions', json={'recipe_id': 'toast'},
                      headers=auth(chef)).json()['id']
    body = client.post(f'/api/sessions/{sid}/submit', headers=auth(chef)).json()

    db = SessionLocal()
    recipe = db.get(Recipe, 'toast')
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
    _play_perfectly(client, chef, 'toast')
    _play_perfectly(client, chef, 'burger')
    profile = client.get('/api/players/me', headers=auth(chef)).json()
    assert profile['unlocked_tier'] >= 2
    assert profile['points'] > 0


def test_points_only_come_from_beating_a_personal_best(client, chef):
    first = _play_perfectly(client, chef, 'toast')
    second = _play_perfectly(client, chef, 'toast')
    if second['score'] <= first['score']:
        assert second['points_awarded'] == 0


# ------------------------------------------------------- leaderboard & stats
def test_leaderboards(client, chef):
    rows = client.get('/api/leaderboard').json()
    assert rows and rows[0]['rank'] == 1
    per_recipe = client.get('/api/leaderboard?recipe_id=toast').json()
    assert all(r['recipe_id'] == 'toast' for r in per_recipe)
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
    result = _play_perfectly(client, chef, 'sandwich')
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


def test_beam_delivery_endpoint(client, chef):
    from app.dsp import beamforming
    sid = client.post('/api/sessions', json={'recipe_id': 'burger'}, headers=auth(chef)).json()['id']
    
    # 1. Unaligned delivery attempt
    bad_req = {
        'speakers': [{'id': i, 'phase': 0.0, 'amplitude': 1.0, 'is_active': True} for i in range(1, 9)],
        'target_angle': 35.0
    }
    r = client.post(f'/api/sessions/{sid}/beam-delivery', json=bad_req, headers=auth(chef))
    assert r.status_code == 200
    res = r.json()
    assert res['is_aligned'] is False
    assert len(res['beam_pattern']) == 73

    # 2. Aligned delivery attempt using exact phase preset
    preset_35 = beamforming.get_preset_phases_for_angle(35.0, 8)
    good_req = {
        'speakers': [{'id': i + 1, 'phase': float(p), 'amplitude': 1.0, 'is_active': True}
                     for i, p in enumerate(preset_35)],
        'target_angle': 35.0
    }
    r2 = client.post(f'/api/sessions/{sid}/beam-delivery', json=good_req, headers=auth(chef))
    assert r2.status_code == 200
    res2 = r2.json()
    assert res2['is_aligned'] is True
    assert res2['accuracy'] >= 90.0
    assert 'Bullseye' in res2['message']
