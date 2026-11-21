from pathlib import Path

import torch
from ored.config import load_config
from ored.models.registry import build_model

CONFIG = Path(__file__).resolve().parent.parent / "configs" / "ored250m.yaml"
EXPECTED_PARAMETERS = 249_798_144


def test_250m_config_builds_the_expected_architecture():
    cfg = load_config(CONFIG)
    with torch.device("meta"):
        model = build_model(cfg, vocab_size=cfg.data.vocab_size)

    assert model.num_parameters() == cfg.model.expected_parameters == EXPECTED_PARAMETERS
    assert model.embeddings_tied
    assert model.attention == "sdpa"
    assert model.gradient_checkpointing
    assert cfg.data.batch_size == 1
    assert cfg.training.grad_accum_steps == 32
    assert model.describe() == {
        "type": "Transformer",
        "vocab_size": 16384,
        "block_size": 1024,
        "d_model": 1024,
        "n_layer": 17,
        "n_head": 16,
        "d_ff": 4608,
        "parameters": EXPECTED_PARAMETERS,
    }


def test_generation_and_api_default_to_250m_checkpoint():
    from ored.inference.generate_cli import DEFAULT_CHECKPOINT as generation_checkpoint
    from ored.inference.predictor import DEFAULT_CHECKPOINT as inference_checkpoint
    from ored.learning.online import DEFAULT_CHECKPOINT as api_checkpoint

    expected = "checkpoints/ored250m/best.pt"
    assert generation_checkpoint == inference_checkpoint == api_checkpoint == expected
