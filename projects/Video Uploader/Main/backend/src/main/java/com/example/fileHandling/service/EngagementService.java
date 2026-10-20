package com.example.fileHandling.service;

import com.fasterxml.jackson.core.type.TypeReference;
import com.fasterxml.jackson.databind.ObjectMapper;
import java.io.IOException;
import java.nio.file.Files;
import java.nio.file.Path;
import java.nio.file.Paths;
import java.nio.file.StandardCopyOption;
import java.util.HashMap;
import java.util.LinkedHashMap;
import java.util.LinkedHashSet;
import java.util.Map;
import java.util.Set;
import java.util.function.LongSupplier;
import org.springframework.beans.factory.annotation.Value;
import org.springframework.stereotype.Service;

/**
 * Views, likes, creators and creator earnings for uploaded media, persisted to a small JSON file.
 * The server (not the browser) decides what a creator has earned: 1 rupee per 5 views, 3 per like.
 */
@Service
public class EngagementService {

  public static final long VIEWS_PER_RUPEE = 5;
  public static final long RUPEES_PER_LIKE = 3;
  private static final long VIEW_COOLDOWN_MS = 30_000;

  public static class MediaStats {
    public String creator = "anonymous";
    public long views;
    public long claimedViews;
    public long claimedLikes;
    public long uploadedAt;
    public Set<String> likedBy = new LinkedHashSet<>();

    public long likes() {
      return likedBy.size();
    }

    MediaStats copy() {
      MediaStats c = new MediaStats();
      c.creator = creator;
      c.views = views;
      c.claimedViews = claimedViews;
      c.claimedLikes = claimedLikes;
      c.uploadedAt = uploadedAt;
      c.likedBy = new LinkedHashSet<>(likedBy);
      return c;
    }
  }

  private final Path file;
  private final ObjectMapper mapper = new ObjectMapper();
  private final Map<String, MediaStats> stats = new LinkedHashMap<>();
  private final Map<String, Long> lastView = new HashMap<>();
  private LongSupplier clock = System::currentTimeMillis;

  public EngagementService(@Value("${city.data-dir:}") String dataDir) {
    String dir = dataDir;
    if (dir == null || dir.isBlank()) dir = System.getenv("DATA_DIR");
    if (dir == null || dir.isBlank()) dir = System.getProperty("user.dir") + "/data";
    this.file = Paths.get(dir, "media-stats.json");
    load();
  }

  void setClock(LongSupplier clock) {
    this.clock = clock;
  }

  private void load() {
    try {
      if (Files.exists(file)) {
        Map<String, MediaStats> read =
            mapper.readValue(file.toFile(), new TypeReference<LinkedHashMap<String, MediaStats>>() {});
        stats.putAll(read);
      }
    } catch (Exception e) {
      System.out.println("Could not read " + file + ": " + e.getMessage() + " (starting empty)");
    }
  }

  private void save() {
    try {
      Files.createDirectories(file.getParent());
      Path tmp = file.resolveSibling(file.getFileName() + ".tmp");
      mapper.writeValue(tmp.toFile(), stats);
      try {
        Files.move(tmp, file, StandardCopyOption.REPLACE_EXISTING, StandardCopyOption.ATOMIC_MOVE);
      } catch (IOException atomicUnsupported) {
        Files.move(tmp, file, StandardCopyOption.REPLACE_EXISTING);
      }
    } catch (IOException e) {
      System.out.println("Could not save " + file + ": " + e.getMessage());
    }
  }

  private MediaStats entry(String name) {
    return stats.computeIfAbsent(name, k -> {
      MediaStats s = new MediaStats();
      s.uploadedAt = clock.getAsLong();
      return s;
    });
  }

  public synchronized void registerUpload(String name, String creator) {
    MediaStats s = new MediaStats();
    s.creator = (creator == null || creator.isBlank()) ? "anonymous" : creator;
    s.uploadedAt = clock.getAsLong();
    stats.put(name, s);
    save();
  }

  /** A snapshot; files that predate engagement tracking read as anonymous with zero views. */
  public synchronized MediaStats stats(String name) {
    MediaStats s = stats.get(name);
    return s == null ? new MediaStats() : s.copy();
  }

  /** Counts a view unless the same client already viewed this file in the last 30 s. */
  public synchronized MediaStats view(String name, String clientKey) {
    long now = clock.getAsLong();
    String key = name + "|" + clientKey;
    Long last = lastView.get(key);
    if (last == null || now - last >= VIEW_COOLDOWN_MS) {
      if (lastView.size() > 5000) lastView.clear();
      lastView.put(key, now);
      entry(name).views += 1;
      save();
    }
    return stats(name);
  }

  /** @return true if the file is now liked by this user, false if the like was removed */
  public synchronized boolean toggleLike(String name, String user) {
    MediaStats s = entry(name);
    boolean liked = s.likedBy.add(user);
    if (!liked) s.likedBy.remove(user);
    save();
    return liked;
  }

  private long pending(MediaStats s) {
    long viewBlocks = Math.max(0, s.views - s.claimedViews) / VIEWS_PER_RUPEE;
    long newLikes = Math.max(0, s.likes() - s.claimedLikes);
    return viewBlocks + newLikes * RUPEES_PER_LIKE;
  }

  public synchronized long claimable(String user) {
    long total = 0;
    for (MediaStats s : stats.values()) {
      if (s.creator.equals(user)) total += pending(s);
    }
    return total;
  }

  /** Pays out everything this creator has earned so far and marks it claimed. */
  public synchronized long claim(String user) {
    long total = 0;
    for (MediaStats s : stats.values()) {
      if (!s.creator.equals(user)) continue;
      total += pending(s);
      long blocks = Math.max(0, s.views - s.claimedViews) / VIEWS_PER_RUPEE;
      s.claimedViews += blocks * VIEWS_PER_RUPEE;
      s.claimedLikes = s.likes();
    }
    if (total > 0) save();
    return total;
  }

  /** Anonymous uploads can be removed by anyone (legacy behaviour); owned uploads only by their creator. */
  public synchronized boolean canDelete(String name, String user) {
    MediaStats s = stats.get(name);
    if (s == null || "anonymous".equals(s.creator)) return true;
    return user != null && user.equals(s.creator);
  }

  public synchronized void forget(String name) {
    if (stats.remove(name) != null) save();
  }
}
