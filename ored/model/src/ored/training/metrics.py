from __future__ import annotations

from dataclasses import dataclass, field



@dataclass
class MetricAccumulator:
    total_examples: int = 0
    sums: dict[str, float] = field(default_factory=dict)

    def update(self, batch_size: int, **values: float) -> None:
        self.total_examples += batch_size
        for key, value in values.items():
            self.sums[key] = self.sums.get(key, 0.0) + value * batch_size

    def compute(self) -> dict[str, float]:
        if self.total_examples == 0:
            return {}
        return {key: total / self.total_examples for key, total in self.sums.items()}
