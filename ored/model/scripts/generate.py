import _bootstrap  # noqa: F401 -- adds the model source directory to sys.path
from ored.inference.generate_cli import main

if __name__ == "__main__":
    raise SystemExit(main())
