"""The finishing stations on the server's own dish: a perfect finish keeps it,
a missed defect costs it (the browser's audit gives 91-98 / ~45-60)."""
import numpy as np
import pytest

from app import delivery as D
from app.dsp import core as C
from app.dsp import instruments, metrics, pipeline
from app.seed import INGREDIENTS, RECIPES

ING = {i['id']: i for i in INGREDIENTS}


def _reference(recipe: dict) -> np.ndarray:
    sigs = [instruments.synth(ING[i]['voice'], C.FRAME, ING[i]['f0'])
            for i in recipe['ingredients']]
    return pipeline.run_pipeline(sigs, pipeline.reference_params(recipe))['cooked']


def _score(ref: np.ndarray, x: np.ndarray) -> float:
    return metrics.dish_metrics(ref, x, common_scale=True)['score']


@pytest.mark.parametrize('recipe', [r for r in RECIPES if r['id'] in D.PROFILES],
                         ids=lambda r: r['id'])
def test_a_perfect_finish_keeps_the_dish_and_a_missed_defect_costs_it(recipe):
    ref = _reference(recipe)
    rid = recipe['id']
    scale = D.hz_per_game_hz(rid, ref, ref.size)
    perfect = dict(oven_f0=4.0, oven_gains=[1.0, 1.0, 1.0], oven_cutoff=26.0,
                   oven_notch=D.profile(rid)['defect_hz'], oven_notch_on=True)
    baked = D.bake(ref, rid, scale, perfect)
    served = D.deliver_on_cart(baked, rid, 'notch', 0.85, D.road_omega(rid))

    assert _score(ref, baked) > 90
    assert _score(ref, served) > 88
    assert _score(ref, D.bake(ref, rid, scale, dict(perfect, oven_notch_on=False))) < 60
    assert _score(ref, D.bake(ref, rid, scale, None)) < 60


def test_finishing_notes_name_what_went_wrong():
    # A real run: resonator aimed at cake's road tone (1.81 rad), bands pushed around.
    cake = dict(oven_f0=3.0, oven_gains=[1.7, 0.8, 0.2], oven_cutoff=17.0, oven_notch=17.0,
                oven_notch_on=False, system_preset='resonator2', system_pole_radius=0.9,
                system_omega=1.85, system_sampling_hz=8000.0)
    notes = ' '.join(D.finishing_notes('cake', cake))
    assert 'amplified the road vibration' in notes and 'dulled the dish' in notes
    assert 'bands reshaped' in notes

    perfect = dict(oven_f0=4.0, oven_gains=[1.0, 1.0, 1.0], oven_cutoff=26.0,
                   oven_notch=D.profile('burger')['defect_hz'], oven_notch_on=True,
                   system_preset='notch', system_pole_radius=0.85,
                   system_omega=D.road_omega('burger'), system_sampling_hz=8000.0)
    assert D.finishing_notes('burger', perfect) == []
    assert 'overtone left in' in ' '.join(D.finishing_notes('burger', dict(perfect, oven_notch_on=False)))
    aliased = dict(perfect, system_omega=D.sensed_road_omega('burger', 1200), system_sampling_hz=1200)
    assert 'aliased sensor reading' in ' '.join(D.finishing_notes('burger', aliased))
