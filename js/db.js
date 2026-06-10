/*
 * db.js — data layer for the Meeting Room Booking app.
 *
 * Backend is chosen automatically from js/config.js, in priority order:
 *
 *   SUPABASE — CONFIG.SUPABASE_URL + SUPABASE_ANON_KEY set. Real hosted
 *              Postgres with two tables (rooms, bookings). Shared & live:
 *              everyone reads/writes the same data instantly.
 *   JSONBIN  — CONFIG.JSONBIN_BIN_ID + JSONBIN_KEY set. One shared JSON doc.
 *   LOCAL    — nothing configured. Data stays in this browser (localStorage).
 *
 * First-run data is seeded from the attached Excel file data/database.xlsx.
 * You can also Export the live data to .xlsx or Import one.
 *
 * Double-booking rule (all modes): no two meetings may overlap in time on the
 * same date. Writes re-check the freshest data first, so it holds across users.
 */

const DB = (() => {
  const LOCAL_KEY = "mrb_db";
  const JSONBIN_BASE = "https://api.jsonbin.io/v3/b";

  const has = (a, b) => typeof CONFIG !== "undefined" && CONFIG[a] && CONFIG[b];
  const mode = has("SUPABASE_URL", "SUPABASE_ANON_KEY")
    ? "supabase"
    : has("JSONBIN_BIN_ID", "JSONBIN_KEY")
    ? "jsonbin"
    : "local";

  // Supabase client (only when in supabase mode and the library loaded).
  let sb = null;
  if (mode === "supabase") {
    if (window.supabase && window.supabase.createClient) {
      sb = window.supabase.createClient(CONFIG.SUPABASE_URL, CONFIG.SUPABASE_ANON_KEY);
    } else {
      console.error("supabase-js failed to load — check the CDN <script> tag.");
    }
  }

  // In-memory cache the synchronous getters/render code reads from.
  let state = { rooms: [], bookings: [] };

  // ---- shared helpers ------------------------------------------------------
  function normaliseRoom(r) {
    return {
      id: Number(r.id),
      name: String(r.name || "").trim(),
      location: String(r.location || "").trim(),
      capacity: Number(r.capacity) || 0,
      facilities: String(r.facilities || "").trim(),
      active: String(r.active).toLowerCase() !== "false",
    };
  }

  const overlaps = (aStart, aEnd, bStart, bEnd) => aStart < bEnd && bStart < aEnd;

  function conflictIn(bookings, { date, startTime, endTime, ignoreId }) {
    return (
      bookings.find(
        (b) =>
          b.date === date &&
          b.id !== ignoreId &&
          overlaps(startTime, endTime, b.startTime, b.endTime)
      ) || null
    );
  }

  const findConflict = (q) => conflictIn(state.bookings, q);
  const nextId = (arr) => arr.reduce((m, x) => Math.max(m, Number(x.id) || 0), 0) + 1;

  // ---- Supabase <-> app field mapping (bookings use snake_case in Postgres) -
  const fromDbBooking = (r) => ({
    id: r.id,
    roomId: r.room_id,
    roomName: r.room_name,
    title: r.title,
    bookedBy: r.booked_by,
    date: r.date,
    startTime: r.start_time,
    endTime: r.end_time,
    createdAt: r.created_at,
  });
  const toDbBooking = (b) => ({
    room_id: b.roomId != null ? Number(b.roomId) : null,
    room_name: b.roomName || "",
    title: b.title,
    booked_by: b.bookedBy || "",
    date: b.date,
    start_time: b.startTime,
    end_time: b.endTime,
  });

  // ---- Excel seed (data/database.xlsx) -------------------------------------
  const SEED_FILE = "data/database.xlsx";

  function sheetRows(wb, name) {
    const key = wb.SheetNames.find((n) => n.toLowerCase() === name);
    return key ? XLSX.utils.sheet_to_json(wb.Sheets[key], { defval: "" }) : [];
  }

  async function seedFromExcel() {
    try {
      const res = await fetch(SEED_FILE, { cache: "no-store" });
      if (!res.ok) throw new Error(`Could not load ${SEED_FILE} (${res.status})`);
      const wb = XLSX.read(await res.arrayBuffer(), { type: "array" });
      return {
        rooms: sheetRows(wb, "rooms").map(normaliseRoom).filter((r) => r.name),
        bookings: sheetRows(wb, "bookings").filter((b) => b.id !== "" && b.id != null),
      };
    } catch (e) {
      console.warn("Excel seed failed, starting empty:", e.message);
      return { rooms: [], bookings: [] };
    }
  }

  // =========================================================================
  //  SUPABASE backend
  // =========================================================================
  async function sbLoad() {
    const [rRes, bRes] = await Promise.all([
      sb.from("rooms").select("*").order("id", { ascending: true }),
      sb.from("bookings").select("*").order("date").order("start_time"),
    ]);
    if (rRes.error) throw rRes.error;
    if (bRes.error) throw bRes.error;
    return {
      rooms: (rRes.data || []).map(normaliseRoom),
      bookings: (bRes.data || []).map(fromDbBooking),
    };
  }

  async function sbClearAll() {
    // Delete bookings first (FK), then rooms. gte(0) matches every row.
    let res = await sb.from("bookings").delete().gte("id", 0);
    if (res.error) throw res.error;
    res = await sb.from("rooms").delete().gte("id", 0);
    if (res.error) throw res.error;
  }

  async function sbInsertRooms(rooms) {
    if (!rooms.length) return [];
    const payload = rooms.map((r) => ({
      name: r.name,
      location: r.location,
      capacity: r.capacity,
      facilities: r.facilities,
      active: r.active !== false,
    }));
    const { data, error } = await sb.from("rooms").insert(payload).select();
    if (error) throw error;
    return data;
  }

  // =========================================================================
  //  JSONBIN / LOCAL backend (single {rooms, bookings} document)
  // =========================================================================
  function jbHeaders(extra) {
    return Object.assign({ "X-Master-Key": CONFIG.JSONBIN_KEY }, extra || {});
  }
  function normaliseDoc(data) {
    const d = data && typeof data === "object" ? data : {};
    return {
      rooms: Array.isArray(d.rooms) ? d.rooms.map(normaliseRoom) : [],
      bookings: Array.isArray(d.bookings) ? d.bookings : [],
    };
  }
  async function docLoad() {
    if (mode === "jsonbin") {
      const res = await fetch(`${JSONBIN_BASE}/${CONFIG.JSONBIN_BIN_ID}/latest`, {
        headers: jbHeaders({ "X-Bin-Meta": "false" }),
        cache: "no-store",
      });
      if (!res.ok) throw new Error(`JSONBin read failed (${res.status})`);
      return normaliseDoc(await res.json());
    }
    return normaliseDoc(JSON.parse(localStorage.getItem(LOCAL_KEY) || "null"));
  }
  async function docSave(data) {
    if (mode === "jsonbin") {
      const res = await fetch(`${JSONBIN_BASE}/${CONFIG.JSONBIN_BIN_ID}`, {
        method: "PUT",
        headers: jbHeaders({ "Content-Type": "application/json", "X-Bin-Versioning": "false" }),
        body: JSON.stringify(data),
      });
      if (!res.ok) throw new Error(`JSONBin write failed (${res.status})`);
    } else {
      localStorage.setItem(LOCAL_KEY, JSON.stringify(data));
    }
    state = data;
  }

  // =========================================================================
  //  Public API (same surface for every backend)
  // =========================================================================
  async function init() {
    try {
      if (mode === "supabase") {
        if (!sb) throw new Error("Supabase client not initialised.");
        let data = await sbLoad();
        if (!data.rooms.length) {
          const seed = await seedFromExcel();
          if (seed.rooms.length) {
            await sbInsertRooms(seed.rooms);
            data = await sbLoad();
          }
        }
        state = data;
      } else {
        let data = await docLoad();
        if (!data.rooms.length) {
          const seed = await seedFromExcel();
          data.rooms = seed.rooms;
          if (!data.bookings.length) data.bookings = seed.bookings;
          await docSave(data);
        }
        state = data;
      }
    } catch (e) {
      console.error("init failed:", e.message || e);
      state = { rooms: [], bookings: [] };
    }
    return state;
  }

  async function refresh() {
    try {
      state = mode === "supabase" ? await sbLoad() : await docLoad();
    } catch (e) {
      console.warn("Refresh failed:", e.message || e);
    }
    return state;
  }

  // Subscribe to live changes (Supabase Realtime). Calls cb() whenever rooms or
  // bookings change in the database. No-op for non-Supabase backends (polling
  // in the page covers those). Returns an unsubscribe function.
  function onChange(cb) {
    if (mode !== "supabase" || !sb) return () => {};
    try {
      const ch = sb
        .channel("mrb-realtime")
        .on("postgres_changes", { event: "*", schema: "public", table: "rooms" }, cb)
        .on("postgres_changes", { event: "*", schema: "public", table: "bookings" }, cb)
        .subscribe();
      return () => sb.removeChannel(ch);
    } catch (e) {
      console.warn("Realtime subscribe failed (polling still works):", e.message || e);
      return () => {};
    }
  }

  // ---- getters (sync, read the cache) --------------------------------------
  const getRooms = () => state.rooms.slice();
  const getActiveRooms = () => state.rooms.filter((r) => r.active);
  const getBookings = () => state.bookings.slice();
  const isShared = () => mode !== "local";
  const backend = () => mode;

  // ---- Rooms ---------------------------------------------------------------
  async function addRoom({ name, location, capacity, facilities }) {
    const clean = normaliseRoom({ name, location, capacity, facilities, active: true });
    if (mode === "supabase") {
      const { data, error } = await sb
        .from("rooms")
        .insert({
          name: clean.name,
          location: clean.location,
          capacity: clean.capacity,
          facilities: clean.facilities,
          active: true,
        })
        .select()
        .single();
      if (error) throw error;
      await refresh();
      return normaliseRoom(data);
    }
    const data = await docLoad();
    clean.id = nextId(data.rooms);
    data.rooms.push(clean);
    await docSave(data);
    return clean;
  }

  async function deleteRoom(id) {
    if (mode === "supabase") {
      const { error } = await sb.from("rooms").delete().eq("id", Number(id));
      if (error) throw error;
      await refresh();
      return;
    }
    const data = await docLoad();
    data.rooms = data.rooms.filter((r) => r.id !== Number(id));
    await docSave(data);
  }

  // Edit a room. Pass only the fields you want to change (e.g. { active: false }).
  async function updateRoom(id, fields) {
    const patch = {};
    if (fields.name !== undefined) patch.name = String(fields.name).trim();
    if (fields.location !== undefined) patch.location = String(fields.location).trim();
    if (fields.capacity !== undefined) patch.capacity = Number(fields.capacity) || 0;
    if (fields.facilities !== undefined) patch.facilities = String(fields.facilities).trim();
    if (fields.active !== undefined) patch.active = !!fields.active;

    if (mode === "supabase") {
      const { error } = await sb.from("rooms").update(patch).eq("id", Number(id));
      if (error) throw error;
      await refresh();
      return;
    }
    const data = await docLoad();
    data.rooms = data.rooms.map((r) => (r.id === Number(id) ? { ...r, ...patch } : r));
    await docSave(data);
  }

  // ---- Bookings (with cross-user conflict check) ---------------------------
  async function addBooking({ roomId, title, bookedBy, date, startTime, endTime }) {
    if (endTime <= startTime) {
      return { ok: false, error: "End time must be after start time." };
    }

    if (mode === "supabase") {
      // Check the freshest bookings for that date so we catch others' slots.
      const { data: sameDay, error: qErr } = await sb
        .from("bookings")
        .select("*")
        .eq("date", date);
      if (qErr) throw qErr;
      const conflict = conflictIn((sameDay || []).map(fromDbBooking), { date, startTime, endTime });
      if (conflict) return { ok: false, error: clashMsg(conflict) };

      const room = state.rooms.find((r) => r.id === Number(roomId));
      const { data, error } = await sb
        .from("bookings")
        .insert(
          toDbBooking({
            roomId,
            roomName: room ? room.name : "",
            title,
            bookedBy,
            date,
            startTime,
            endTime,
          })
        )
        .select()
        .single();
      if (error) throw error;
      await refresh();
      return { ok: true, booking: fromDbBooking(data) };
    }

    // jsonbin / local
    const data = await docLoad();
    const conflict = conflictIn(data.bookings, { date, startTime, endTime });
    if (conflict) return { ok: false, error: clashMsg(conflict) };
    const room = data.rooms.find((r) => r.id === Number(roomId));
    const booking = {
      id: nextId(data.bookings),
      roomId: Number(roomId),
      roomName: room ? room.name : "",
      title, bookedBy, date, startTime, endTime,
      createdAt: new Date().toISOString(),
    };
    data.bookings.push(booking);
    await docSave(data);
    return { ok: true, booking };
  }

  function clashMsg(c) {
    const where = c.roomName ? ` in ${c.roomName}` : "";
    return `That time clashes with "${c.title}"${where} (${c.startTime}–${c.endTime}). No two meetings can overlap.`;
  }

  async function deleteBooking(id) {
    if (mode === "supabase") {
      const { error } = await sb.from("bookings").delete().eq("id", Number(id));
      if (error) throw error;
      await refresh();
      return;
    }
    const data = await docLoad();
    data.bookings = data.bookings.filter((b) => Number(b.id) !== Number(id));
    await docSave(data);
  }

  return {
    init,
    refresh,
    onChange,
    isShared,
    backend,
    getRooms,
    getActiveRooms,
    getBookings,
    findConflict,
    addRoom,
    updateRoom,
    deleteRoom,
    addBooking,
    deleteBooking,
  };
})();
