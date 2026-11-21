from __future__ import annotations

import time
import uuid
from dataclasses import asdict, dataclass, field
from enum import Enum
from typing import Any


def new_id() -> str:
    return str(uuid.uuid4())


def now() -> str:
    return time.strftime("%Y-%m-%dT%H:%M:%SZ", time.gmtime())


class Role(str, Enum):
    USER = "user"
    ASSISTANT = "assistant"


class CandidateStatus(str, Enum):
    PENDING = "pending"
    APPROVED = "approved"
    REJECTED = "rejected"
    WITHDRAWN = "withdrawn"


class SessionStatus(str, Enum):
    QUEUED = "queued"
    RUNNING = "running"
    EVALUATED = "evaluated"
    FAILED = "failed"
    CANCELLED = "cancelled"


class WorkerStatus(str, Enum):
    JOINING = "joining"
    READY = "ready"
    TRAINING = "training"
    CHECKPOINTING = "checkpointing"
    COMPLETED = "completed"
    FAILED = "failed"
    DISCONNECTED = "disconnected"


class CheckpointPart(str, Enum):
    FILE = "file"
    MANIFEST = "manifest"
    SHARD = "shard"


class VersionStatus(str, Enum):
    CANDIDATE = "candidate"
    PRODUCTION = "production"
    RETIRED = "retired"


class CheckpointKind(str, Enum):
    BASE = "base"
    BEST = "best"
    LIVE = "live"
    HISTORY = "history"
    EXPORT = "export"


@dataclass
class Conversation:
    id: str = field(default_factory=new_id)
    user_id: str | None = None
    visitor: str = ""
    title: str = ""
    created_at: str = field(default_factory=now)
    updated_at: str = field(default_factory=now)
    message_count: int = 0

    def __post_init__(self) -> None:
        if not self.visitor:
            self.visitor = "account" if self.user_id else "anonymous"


@dataclass
class Message:
    id: str = field(default_factory=new_id)
    conversation_id: str = ""
    role: Role = Role.USER
    content: str = ""
    model_version: str | None = None
    created_at: str = field(default_factory=now)


@dataclass
class LearningCandidate:
    id: str = field(default_factory=new_id)
    conversation_id: str = ""
    prompt: str = ""
    response: str = ""
    status: CandidateStatus = CandidateStatus.PENDING
    source: str = "conversation"
    fingerprint: str = ""
    redacted: bool = False
    quality: float | None = None
    reviewed_by: str | None = None
    reviewed_at: str | None = None
    review_note: str = ""
    created_at: str = field(default_factory=now)


@dataclass
class TrainingExample:
    id: str = field(default_factory=new_id)
    candidate_id: str = ""
    dataset_tag: str = ""
    prompt: str = ""
    response: str = ""
    approved_by: str | None = None
    created_at: str = field(default_factory=now)


@dataclass
class Dataset:
    id: str = field(default_factory=new_id)
    name: str = ""
    kind: str = "text"
    summary: str = ""
    generator: str = ""
    spec: dict[str, Any] = field(default_factory=dict)
    samples: list[dict[str, Any]] = field(default_factory=list)
    version: int = 1
    created_at: str = field(default_factory=now)
    updated_at: str = field(default_factory=now)
    source: str = "generated"
    sha256: str | None = None
    record_count: int = 0
    selection: dict[str, Any] = field(default_factory=dict)
    split_counts: dict[str, int] = field(default_factory=dict)
    storage_path: str | None = None


@dataclass
class TrainingData:
    id: str = field(default_factory=new_id)
    type: str = ""
    category: str = ""
    subject: str | None = None
    topic: str | None = None
    input: str = ""
    output: str = ""
    difficulty: str | None = None
    language: str = "en"
    source: str = "manual"
    dataset_tag: str | None = None
    enabled: bool = True
    verified: bool = False
    fingerprint: str = ""
    metadata: dict[str, Any] = field(default_factory=dict)
    created_at: str = field(default_factory=now)
    updated_at: str = field(default_factory=now)


@dataclass
class TrainingSession:
    id: str = field(default_factory=new_id)
    dataset_tag: str = ""
    base_version: str | None = None
    status: SessionStatus = SessionStatus.QUEUED
    config: dict[str, Any] = field(default_factory=dict)
    metrics: dict[str, float] = field(default_factory=dict)
    example_count: int = 0
    conversation_count: int = 0
    error: str = ""
    started_at: str | None = None
    finished_at: str | None = None
    created_at: str = field(default_factory=now)
    session_key: str | None = None
    run_name: str = ""
    dataset_id: str | None = None

    def __post_init__(self) -> None:
        self.status = SessionStatus(self.status)


@dataclass
class TrainingWorker:
    id: str = field(default_factory=new_id)
    session_id: str = ""
    worker_id: str = ""
    rank: int | None = None
    node_rank: int | None = None
    local_rank: int | None = None
    hostname: str = ""
    device: str = ""
    gpu_name: str = ""
    torch_version: str = ""
    status: WorkerStatus = WorkerStatus.JOINING
    last_heartbeat: str = field(default_factory=now)
    started_at: str = field(default_factory=now)
    finished_at: str | None = None
    error: str = ""
    created_at: str = field(default_factory=now)

    def __post_init__(self) -> None:
        self.status = WorkerStatus(self.status)


@dataclass
class ModelVersion:
    id: str = field(default_factory=new_id)
    version: str = ""
    status: VersionStatus = VersionStatus.CANDIDATE
    session_id: str | None = None
    checkpoint_path: str = ""
    metrics: dict[str, float] = field(default_factory=dict)
    notes: str = ""
    promoted_at: str | None = None
    created_at: str = field(default_factory=now)

    def __post_init__(self) -> None:
        self.status = VersionStatus(self.status)


@dataclass
class Checkpoint:
    id: str = field(default_factory=new_id)
    version_id: str | None = None
    session_id: str | None = None
    kind: CheckpointKind = CheckpointKind.BEST
    run_name: str = ""
    bucket_id: str = "ored-checkpoints"
    object_path: str = ""
    size_bytes: int = 0
    sha256: str = ""
    format_version: int = 1
    torch_version: str = ""
    epoch: int = 0
    metrics: dict[str, float] = field(default_factory=dict)
    uploaded_by: str | None = None
    created_at: str = field(default_factory=now)
    global_step: int = 0
    is_current: bool = False
    parent_checkpoint_id: str | None = None
    promotion_metric: str | None = None
    promotion_mode: str | None = None
    verified_at: str | None = None
    part: CheckpointPart = CheckpointPart.FILE
    checkpoint_group_id: str | None = None
    rank: int | None = None
    world_size: int = 1
    is_complete: bool = True
    upload_status: str = "verified"

    def __post_init__(self) -> None:
        self.kind = CheckpointKind(self.kind)
        self.part = CheckpointPart(self.part)

    @property
    def is_logical(self) -> bool:
        return self.part is not CheckpointPart.SHARD


RECORD_TABLES = {
    Dataset: "ored_datasets",
    Conversation: "ored_conversations",
    Message: "ored_messages",
    LearningCandidate: "ored_learning_candidates",
    TrainingExample: "ored_training_examples",
    TrainingData: "ored_training_data",
    TrainingSession: "ored_training_sessions",
    TrainingWorker: "ored_training_workers",
    ModelVersion: "ored_model_versions",
    Checkpoint: "ored_checkpoints",
}


def to_row(record: Any) -> dict[str, Any]:
    row = asdict(record)
    for key, value in row.items():
        if isinstance(value, Enum):
            row[key] = value.value
    return row
