package com.bank.store;

import com.bank.model.User;
import java.nio.file.Path;
import java.time.LocalDateTime;
import java.util.List;
import java.util.Optional;

/** users.csv. */
public class UserStore extends CsvStore<User> {

    static final List<String> HEADER = List.of("id", "email", "password", "full_name", "created_at");

    public UserStore(Path dataDir) {
        super(dataDir.resolve("users.csv"), HEADER);
    }

    @Override
    protected User fromRow(CsvRow row) {
        return new User(
                row.getLong("id"),
                row.getString("email"),
                row.getString("password"),
                row.getString("full_name"),
                row.getTimestamp("created_at"));
    }

    @Override
    protected CsvRow toRow(User user) {
        return new CsvRow()
                .put("id", String.valueOf(user.id()))
                .put("email", user.email())
                .put("password", user.password())
                .put("full_name", user.fullName())
                .put("created_at", user.createdAt().toString());
    }

    @Override
    protected long idOf(User user) {
        return user.id();
    }

    /** Case-insensitive, because nobody types their email the same way twice. */
    public Optional<User> findByEmail(String email) {
        String normalised = email == null ? "" : email.trim().toLowerCase();
        return findFirst(user -> user.email().equals(normalised));
    }

    /** Only used by the tests, but it shows the shape of a create. */
    public User create(String email, String password, String fullName) {
        User user = new User(nextId(), email, password, fullName, LocalDateTime.now());
        add(user);
        return user;
    }
}
