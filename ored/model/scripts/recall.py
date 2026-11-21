import _bootstrap  # noqa: F401 -- adds the model source directory to sys.path
from ored.evaluation.recall import main

if __name__ == "__main__":
    raise SystemExit(main())
