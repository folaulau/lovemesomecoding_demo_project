package com.bank.ui;

import com.bank.error.BankException;
import com.bank.model.Account;
import com.bank.model.Money;
import com.bank.model.Transaction;
import com.bank.model.User;
import com.bank.service.AuthService;
import com.bank.service.BankService;
import java.math.BigDecimal;
import java.util.List;

/**
 * The screens: sign in, then a menu loop until the customer signs out.
 *
 * <p>Everything here is reading input and printing output. Not one balance is calculated in this
 * file — that all lives in {@link BankService}. Keeping the line between them sharp is the single
 * most useful habit in this whole project.
 */
public class BankMenu {

    private static final int STATEMENT_LINES = 10;

    private final Console console;
    private final AuthService authService;
    private final BankService bankService;

    public BankMenu(Console console, AuthService authService, BankService bankService) {
        this.console = console;
        this.authService = authService;
        this.bankService = bankService;
    }

    /** The outer loop: sign in, bank, sign out, repeat. */
    public void run() {
        console.heading("Welcome to Love Some Coding Bank");
        console.print("Test sign-in: alice@bank.test / password123");

        while (true) {
            User user = signIn();
            if (user == null) {
                console.blank();
                console.print("Goodbye.");
                return;
            }
            session(user);
        }
    }

    /** Three attempts, then out — the standard shape, and it stops a piped script looping. */
    private User signIn() {
        for (int attempt = 1; attempt <= 3; attempt++) {
            console.heading("Sign in");
            String email = console.readLine("Email (blank to quit): ");
            // null means input ran out (Ctrl-D or the end of a piped script); empty means they
            // pressed enter to quit. Both end the app, but they are not the same event — and note
            // this is `== null`, never `== ""`. Comparing Strings with == compares references,
            // which is the most common bug in beginner Java. Use .isEmpty() or .equals().
            if (email == null || email.isEmpty()) {
                return null;
            }
            String password = console.readLine("Password: ");
            if (password == null) {
                return null;
            }

            try {
                User user = authService.signIn(email, password);
                console.success("Signed in as " + user.fullName());
                return user;
            } catch (BankException e) {
                // One catch for every failure the services can raise — the reason BankException
                // has subclasses rather than being four unrelated classes.
                console.error(e.getMessage() + " (attempt %d of 3)".formatted(attempt));
            }
        }
        console.error("Too many failed attempts.");
        return null;
    }

    /** The menu, for as long as this customer stays signed in. */
    private void session(User user) {
        while (true) {
            console.heading("Hello, " + user.firstName());
            console.print("Total balance: " + Money.format(bankService.totalBalance(user)));
            console.blank();
            console.print("  1) View accounts");
            console.print("  2) Deposit");
            console.print("  3) Withdraw");
            console.print("  4) Transfer between accounts");
            console.print("  5) Transaction history");
            console.print("  6) Sign out");
            console.blank();

            int choice = console.readChoice("Choose 1-6: ", 1, 6, 6);

            // A switch over ints. Java 14+ arrow labels: no fall-through, no `break` to forget.
            try {
                switch (choice) {
                    case 1 -> viewAccounts(user);
                    case 2 -> deposit(user);
                    case 3 -> withdraw(user);
                    case 4 -> transfer(user);
                    case 5 -> history(user);
                    case 6 -> {
                        console.success("Signed out.");
                        return;
                    }
                    default -> console.error("That is not an option.");
                }
            } catch (BankException e) {
                // Any rule the services enforce surfaces here as a message, and the loop continues.
                // One handler for the whole menu beats a try/catch inside each case.
                console.error(e.getMessage());
            }
        }
    }

    private void viewAccounts(User user) {
        console.heading("Your accounts");
        List<Account> accounts = bankService.accountsOf(user);
        printAccounts(accounts);
    }

    private void deposit(User user) {
        console.heading("Deposit");
        Account account = chooseAccount(user, "Deposit into which account");
        if (account == null) {
            return;
        }
        BigDecimal amount = console.readAmount("Amount to deposit: ");
        if (amount == null) {
            return;
        }
        String note = console.readLine("Description (optional): ");

        Transaction record = bankService.deposit(account, amount, note);
        console.success("Deposited %s. New balance: %s"
                .formatted(Money.format(record.amount()), Money.format(record.balanceAfter())));
    }

    private void withdraw(User user) {
        console.heading("Withdraw");
        Account account = chooseAccount(user, "Withdraw from which account");
        if (account == null) {
            return;
        }
        BigDecimal amount = console.readAmount("Amount to withdraw: ");
        if (amount == null) {
            return;
        }
        String note = console.readLine("Description (optional): ");

        Transaction record = bankService.withdraw(account, amount, note);
        console.success("Withdrew %s. New balance: %s"
                .formatted(Money.format(record.amount()), Money.format(record.balanceAfter())));
    }

    private void transfer(User user) {
        console.heading("Transfer");
        List<Account> accounts = bankService.accountsOf(user);
        if (accounts.size() < 2) {
            console.error("You need at least two accounts to transfer between them.");
            return;
        }
        Account from = chooseAccount(user, "Transfer from");
        if (from == null) {
            return;
        }
        Account to = chooseAccount(user, "Transfer to");
        if (to == null) {
            return;
        }
        BigDecimal amount = console.readAmount("Amount to transfer: ");
        if (amount == null) {
            return;
        }

        bankService.transfer(from, to, amount);
        console.success("Transferred %s from %s to %s."
                .formatted(Money.format(amount), from.number(), to.number()));
        printAccounts(bankService.accountsOf(user));
    }

    private void history(User user) {
        console.heading("Transaction history");
        Account account = chooseAccount(user, "History for which account");
        if (account == null) {
            return;
        }

        List<Transaction> transactions = bankService.statement(account, STATEMENT_LINES);
        console.blank();
        console.print(bankService.refresh(account).toString());
        console.blank();
        if (transactions.isEmpty()) {
            console.print("  No transactions yet.");
            return;
        }
        console.print("  %-16s  %-14s  %12s  %14s  %s"
                .formatted("WHEN", "WHAT", "AMOUNT", "BALANCE", "DESCRIPTION"));
        for (Transaction transaction : transactions) {
            console.print("  " + transaction.toStatementLine());
        }
    }

    /** Prints a numbered list of the customer's accounts and returns the one they pick. */
    private Account chooseAccount(User user, String prompt) {
        List<Account> accounts = bankService.accountsOf(user);
        if (accounts.isEmpty()) {
            console.error("You have no accounts.");
            return null;
        }
        if (accounts.size() == 1) {
            return accounts.get(0); // Nothing to choose — do not make them press 1.
        }

        printAccounts(accounts);
        int choice = console.readChoice(
                "%s (1-%d, 0 to cancel): ".formatted(prompt, accounts.size()), 0, accounts.size(), 0);
        if (choice == 0) {
            return null;
        }
        // The menu is 1-based and the list is 0-based. The classic off-by-one, in its natural home.
        return accounts.get(choice - 1);
    }

    private void printAccounts(List<Account> accounts) {
        console.blank();
        for (int i = 0; i < accounts.size(); i++) {
            console.print("  %d) %s".formatted(i + 1, accounts.get(i)));
        }
    }
}
