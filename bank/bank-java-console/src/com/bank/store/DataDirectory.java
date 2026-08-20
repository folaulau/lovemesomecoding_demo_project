package com.bank.store;

import java.io.IOException;
import java.io.UncheckedIOException;
import java.nio.file.Files;
import java.nio.file.Path;
import java.nio.file.StandardCopyOption;
import java.util.List;

/**
 * Finds the CSV "database" and seeds it on first run.
 *
 * <p>The working files are gitignored and the seed copies are committed, so running the app can
 * never dirty the repository, and deleting the working files is a full reset. The Python app in
 * ../bank-python-console reads the exact same directory — the two are interchangeable.
 */
public final class DataDirectory {

    private static final List<String> FILES = List.of("users.csv", "accounts.csv", "transactions.csv");

    private DataDirectory() {}

    /**
     * The directory holding the CSVs.
     *
     * <p>BANK_DATA_DIR overrides it, which is how the tests point the app at a throwaway temp
     * directory instead of the real data. Configuration through the environment, no code change.
     */
    public static Path resolve() {
        String override = System.getenv("BANK_DATA_DIR");
        if (override != null && !override.isBlank()) {
            return Path.of(override);
        }
        // Relative to wherever the app was started, which run.sh guarantees is the app directory.
        return Path.of("..", "data").normalize();
    }

    /** Copies any missing file out of data/seed/. Existing files are never touched. */
    public static Path prepare(Path dataDir) {
        Path seedDir = dataDir.resolve("seed");
        try {
            Files.createDirectories(dataDir);
            for (String name : FILES) {
                Path target = dataDir.resolve(name);
                Path seed = seedDir.resolve(name);
                if (!Files.exists(target) && Files.exists(seed)) {
                    Files.copy(seed, target, StandardCopyOption.REPLACE_EXISTING);
                }
            }
        } catch (IOException e) {
            throw new UncheckedIOException("Could not prepare the data directory " + dataDir, e);
        }
        return dataDir;
    }
}
