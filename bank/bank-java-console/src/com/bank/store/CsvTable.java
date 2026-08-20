package com.bank.store;

import java.io.IOException;
import java.io.UncheckedIOException;
import java.nio.charset.StandardCharsets;
import java.nio.file.Files;
import java.nio.file.Path;
import java.util.ArrayList;
import java.util.List;

/**
 * Reads and writes one CSV file — this app's stand-in for a database table.
 *
 * <p>Every write rewrites the whole file. That is O(n) per save and would be indefensible in a real
 * system; it is chosen here because it is obvious, and because the alternative (in-place edits at
 * byte offsets) would bury the lesson. A database does the clever version for you, which is rather
 * the point of using one.
 */
public class CsvTable {

    private final Path file;
    private final List<String> header;

    public CsvTable(Path file, List<String> header) {
        this.file = file;
        // List.copyOf gives an unmodifiable copy, so a caller cannot change the header later by
        // holding on to the list they passed in. Defensive copying, in one call.
        this.header = List.copyOf(header);
    }

    public Path file() {
        return file;
    }

    /** Reads every row. Returns an empty list when the file does not exist yet. */
    public List<CsvRow> readAll() {
        if (!Files.exists(file)) {
            return List.of();
        }
        // try-with-resources is not needed for readAllLines — it opens and closes the file itself.
        List<String> lines = readLines();
        List<CsvRow> rows = new ArrayList<>();
        // Start at 1: line 0 is the header.
        for (int i = 1; i < lines.size(); i++) {
            String line = lines.get(i);
            if (line.isBlank()) {
                continue; // A trailing newline is normal; a blank row is not data.
            }
            List<String> fields = parseLine(line);
            CsvRow row = new CsvRow();
            for (int c = 0; c < header.size(); c++) {
                // Tolerate a short line rather than throwing IndexOutOfBounds on a hand-edited file.
                row.put(header.get(c), c < fields.size() ? fields.get(c) : "");
            }
            rows.add(row);
        }
        return rows;
    }

    /** Replaces the file contents with these rows, header first. */
    public void writeAll(List<CsvRow> rows) {
        StringBuilder out = new StringBuilder();
        out.append(String.join(",", header)).append('\n');
        for (CsvRow row : rows) {
            List<String> fields = new ArrayList<>();
            for (String column : header) {
                fields.add(escape(row.values().getOrDefault(column, "")));
            }
            out.append(String.join(",", fields)).append('\n');
        }
        try {
            Files.createDirectories(file.getParent());
            // Write to a temp file, then move it into place. If the process dies mid-write the
            // original file is still intact — a poor man's atomic save, and a habit worth having.
            Path temp = file.resolveSibling(file.getFileName() + ".tmp");
            Files.writeString(temp, out.toString(), StandardCharsets.UTF_8);
            Files.move(temp, file, java.nio.file.StandardCopyOption.REPLACE_EXISTING);
        } catch (IOException e) {
            // IOException is checked, but nothing up the call chain can do anything useful about a
            // failed disk write, so it is wrapped in the unchecked UncheckedIOException.
            throw new UncheckedIOException("Could not write " + file, e);
        }
    }

    private List<String> readLines() {
        try {
            return Files.readAllLines(file, StandardCharsets.UTF_8);
        } catch (IOException e) {
            throw new UncheckedIOException("Could not read " + file, e);
        }
    }

    /**
     * Splits one CSV line.
     *
     * <p><b>Why not simply {@code line.split(",")}?</b> Because a field may contain a comma if it is
     * quoted: {@code 1,"Tupou, Bob",5.00} is three fields, not four. split() gives four and the row
     * is silently wrong from then on. This walks the characters and tracks whether it is inside
     * quotes — the smallest correct thing. (A real project uses a CSV library; this one is here to
     * show what the library is doing.)
     *
     * <p>Public and static so the tests can call it on its own, without a file. A pure function —
     * a String in, a List out, no state touched — is the easiest kind of code there is to test,
     * which is a good reason to write parsing this way.
     */
    public static List<String> parseLine(String line) {
        List<String> fields = new ArrayList<>();
        StringBuilder field = new StringBuilder();
        boolean inQuotes = false;

        for (int i = 0; i < line.length(); i++) {
            char c = line.charAt(i);
            if (inQuotes) {
                if (c == '"') {
                    // "" inside a quoted field means one literal quote character.
                    if (i + 1 < line.length() && line.charAt(i + 1) == '"') {
                        field.append('"');
                        i++;
                    } else {
                        inQuotes = false;
                    }
                } else {
                    field.append(c);
                }
            } else if (c == '"') {
                inQuotes = true;
            } else if (c == ',') {
                fields.add(field.toString());
                field.setLength(0); // Reuse the builder rather than allocating a new one.
            } else {
                field.append(c);
            }
        }
        fields.add(field.toString()); // The last field has no comma after it.
        return fields;
    }

    /** The mirror of {@link #parseLine}: quote a field only when it needs it. */
    public static String escape(String value) {
        if (value.contains(",") || value.contains("\"") || value.contains("\n")) {
            return '"' + value.replace("\"", "\"\"") + '"';
        }
        return value;
    }
}
