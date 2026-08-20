package com.bank;

import com.bank.service.AuthService;
import com.bank.service.BankService;
import com.bank.store.AccountStore;
import com.bank.store.DataDirectory;
import com.bank.store.TransactionStore;
import com.bank.store.UserStore;
import com.bank.ui.BankMenu;
import com.bank.ui.Console;
import java.nio.file.Path;

/**
 * The entry point, and nothing else.
 *
 * <p>All main() does is build the objects and wire them together — stores, then services that need
 * stores, then the menu that needs services. That ordering is not an accident: it is the dependency
 * graph, assembled by hand. Spring does this same job with annotations, and it is easier to trust
 * once you have seen the version that fits on a screen.
 */
public class BankApp {

    public static void main(String[] args) {
        Path dataDir = DataDirectory.prepare(DataDirectory.resolve());

        UserStore userStore = new UserStore(dataDir);
        AccountStore accountStore = new AccountStore(dataDir);
        TransactionStore transactionStore = new TransactionStore(dataDir);

        AuthService authService = new AuthService(userStore);
        BankService bankService = new BankService(accountStore, transactionStore);

        new BankMenu(new Console(), authService, bankService).run();
    }
}
