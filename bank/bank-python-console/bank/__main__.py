"""Makes the package runnable: `python3 -m bank`.

Python runs this file when a *package* is given to -m, the way it runs a module given by name.
It is the closest thing Python has to Java's `public static void main`.
"""

from .app import main

# The idiom, and worth understanding rather than copying: when a file is run directly, Python sets
# its __name__ to "__main__". When it is imported, __name__ is the module's name instead. So this
# guard means "run only when started, never when imported" — which is what stops `import bank`
# from launching the whole app.
if __name__ == "__main__":
    main()
