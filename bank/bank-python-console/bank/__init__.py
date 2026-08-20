"""Love Some Coding Bank — a console bank stored in CSV files.

A package is a directory with this file in it. Everything importable lives in the modules beside
it, and `from bank.money import Money` works because this file exists.

The layout deliberately mirrors ../bank-java-console, module for class, so the two can be read
side by side:

    money.py      ↔  model/Money.java
    models.py     ↔  model/{User,Account,Transaction,AccountType,TransactionType}.java
    errors.py     ↔  error/*.java
    csv_table.py  ↔  store/{CsvTable,CsvRow}.java
    stores.py     ↔  store/{CsvStore,UserStore,AccountStore,TransactionStore}.java
    services.py   ↔  service/{AuthService,BankService}.java
    console.py    ↔  ui/Console.java
    menu.py       ↔  ui/BankMenu.java
    app.py        ↔  BankApp.java

Both apps read the same ../data/*.csv files.
"""

__version__ = "1.0.0"
