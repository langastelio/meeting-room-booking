/*
 * db.js — data layer for the Meeting Room Booking app.
 *
 * Two storage modes (chosen automatically from js/config.js):
 *
 *   SHARED  — when CONFIG.JSONBIN_BIN_ID + JSONBIN_KEY are set, the whole
 *             database ({rooms, bookings}) lives in one JSONBin.io bin, so
 *             every browser/person reads and writes the SAME data.
 *
 *   LOCAL   — when config is blank, data is kept in this browser only
 *             (localStorage). Handy for testing without a backend.
 *
 * In both modes the seed comes from the spreadsheet files in /data, and you
 * can Export the live data to a real Excel (.xlsx) workbook or Import one.
 *
 * Cross-user double-booking: every write does READ-MODIFY-WRITE against the
 * latest shared data, so two people can't grab the same time slot.
 */

const DB = (() => {
  const LOCAL_KEY = "mrb_db";
  const BASE = "https://api.jsonbin.io/v3/b";

  const remote =
    typeof CONFIG !== "undefined" && CONFIG.JSONBIN_BIN_ID && CONFIG.JSONBIN_KEY;

  // In-memory cache that the synchronous getters/render code reads from.
  let state = { rooms: [], bookings: [] };

  // ---- low-level storage ---------------------------------------------------
  function headers(extra) {
    return Object.assign({ "X-Master-Key": CONFIG.JSONBIN_KEY }, extra || {});
  }

  async function remoteLoad() {
    const res = await fetch(`${BASE}/${CONFIG.JSONBIN_BIN_ID}/latest`, {
      headers: headers({ "X-Bin-Meta": "false" }),
      cache: "no-store",
    });
    if (!res.ok) throw new Error(`JSONBin read failed (${res.status})`);
    const data = await res.json();
    return normaliseDb(data);
  }

  async function remoteSave(data) {
    const res = await fetch(`${BASE}/${CONFIG.JSONBIN_BIN_ID}`, {
      method: "PUT",
      headers: headers({ "Content-Type": "application/json", "X-Bin-Versioning": "false" }),
      body: JSON.stringify(data),
    });
    if (!res.ok) throw new Error(`JSONBin write failed (${res.status})`);
  }

  // Always returns the freshest copy of the DB (remote or local).
  async function load() {
    if (remote) return await remoteLoad();
    return normaliseDb(JSON.parse(localStorage.getItem(LOCAL_KEY) || "null"));
  }

  // Persists the DB and refreshes the in-memory cache.
  async function save(data) {
    if (remote) await remoteSave(data);
    else localStorage.setItem(LOCAL_KEY, JSON.stringify(data));
    state = data;
  }

  function normaliseDb(data) {
    const d = data && typeof data === "object" ? data : {};
    return {
      rooms: Array.isArray(d.rooms) ? d.rooms.map(normaliseRoom) : [],
      bookings: Array.isArray(d.bookings) ? d.bookings : [],
    };
  }

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

  // ---- the attached Excel file IS the database source ----------------------
  // data/database.xlsx holds two sheets: "Rooms" and "Bookings".
  const SEED_FILE = "data/database.xlsx";

  function sheetRows(wb, name) {
    const key = wb.SheetNames.find((n) => n.toLowerCase() === name) || null;
    return key ? XLSX.utils.sheet_to_json(wb.Sheets[key], { defval: "" }) : [];
  }

  // Reads the whole DB ({rooms, bookings}) from the attached Excel workbook.
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

  // ---- public init ---------------------------------------------------------
  // Loads the DB; if there are no rooms yet, seeds from the spreadsheet.
  async function init() {
    let data;
    try {
      data = await load();
    } catch (e) {
      console.error(e);
      // If the shared backend is unreachable, fall back to an empty cache so
      // the UI still renders instead of throwing.
      data = { rooms: [], bookings: [] };
    }
    if (!data.rooms.length) {
      const seed = await seedFromExcel();
      data.rooms = seed.rooms;
      if (!data.bookings.length) data.bookings = seed.bookings;
      try {
        await save(data);
      } catch (e) {
        console.warn("Could not persist seed:", e.message);
      }
    }
    state = data;
    return state;
  }

  // Re-pull the latest shared data (used on window focus / manual refresh).
  async function refresh() {
    try {
      state = await load();
    } catch (e) {
      console.warn("Refresh failed:", e.message);
    }
    return state;
  }

  // ---- getters (sync, read the cache) --------------------------------------
  const getRooms = () => state.rooms.slice();
  const getActiveRooms = () => state.rooms.filter((r) => r.active);
  const getBookings = () => state.bookings.slice();
  const isShared = () => !!remote;

  // ---- helpers -------------------------------------------------------------
  const overlaps = (aStart, aEnd, bStart, bEnd) => aStart < bEnd && bStart < aEnd;

  // Conflict against whatever DB object is passed in (the FRESH one on writes).
  // Global rule: no two meetings may overlap in time on the same date,
  // regardless of room.
  function conflictIn(data, { date, startTime, endTime, ignoreId }) {
    return (
      data.bookings.find(
        (b) =>
          b.date === date &&
          b.id !== ignoreId &&
          overlaps(startTime, endTime, b.startTime, b.endTime)
      ) || null
    );
  }

  // Sync convenience check against the cache (for UI hints only).
  const findConflict = (q) => conflictIn(state, q);

  const nextId = (arr) => arr.reduce((max, x) => Math.max(max, Number(x.id) || 0), 0) + 1;

  // ---- Rooms (async writes) ------------------------------------------------
  async function addRoom({ name, location, capacity, facilities }) {
    const data = await load();
    const room = normaliseRoom({
      id: nextId(data.rooms),
      name, location, capacity, facilities, active: true,
    });
    data.rooms.push(room);
    await save(data);
    return room;
  }

  async function deleteRoom(id) {
    const data = await load();
    data.rooms = data.rooms.filter((r) => r.id !== Number(id));
    await save(data);
  }

  // ---- Bookings (async, with cross-user conflict check) --------------------
  async function addBooking({ roomId, title, bookedBy, date, startTime, endTime }) {
    if (endTime <= startTime) {
      return { ok: false, error: "End time must be after start time." };
    }
    // READ the freshest data so a conflict booked by someone else is caught.
    const data = await load();
    const conflict = conflictIn(data, { date, startTime, endTime });
    if (conflict) {
      const where = conflict.roomName ? ` in ${conflict.roomName}` : "";
      return {
        ok: false,
        error: `That time clashes with "${conflict.title}"${where} (${conflict.startTime}–${conflict.endTime}). No two meetings can overlap.`,
      };
    }
    const room = data.rooms.find((r) => r.id === Number(roomId));
    const booking = {
      id: nextId(data.bookings),
      roomId: Number(roomId),
      roomName: room ? room.name : "",
      title, bookedBy, date, startTime, endTime,
      createdAt: new Date().toISOString(),
    };
    data.bookings.push(booking);
    await save(data);
    return { ok: true, booking };
  }

  async function deleteBooking(id) {
    const data = await load();
    data.bookings = data.bookings.filter((b) => Number(b.id) !== Number(id));
    await save(data);
  }

  // ---- Excel import / export ----------------------------------------------
  function exportWorkbook() {
    const wb = XLSX.utils.book_new();
    XLSX.utils.book_append_sheet(wb, XLSX.utils.json_to_sheet(getRooms()), "Rooms");
    XLSX.utils.book_append_sheet(wb, XLSX.utils.json_to_sheet(getBookings()), "Bookings");
    // Same name/shape as the seed file, so you can drop it back into /data.
    XLSX.writeFile(wb, "database.xlsx");
  }

  async function importWorkbook(file) {
    const buf = await file.arrayBuffer();
    const wb = XLSX.read(buf, { type: "array" });
    const data = await load();
    const findSheet = (name) => wb.SheetNames.find((n) => n.toLowerCase() === name);

    const roomsSheet = findSheet("rooms") || wb.SheetNames[0];
    if (roomsSheet) {
      data.rooms = XLSX.utils
        .sheet_to_json(wb.Sheets[roomsSheet], { defval: "" })
        .map(normaliseRoom);
    }
    const bookingsSheet = findSheet("bookings");
    if (bookingsSheet) {
      data.bookings = XLSX.utils.sheet_to_json(wb.Sheets[bookingsSheet], { defval: "" });
    }
    await save(data);
  }

  async function resetToSeed() {
    await save(await seedFromExcel());
  }

  return {
    init,
    refresh,
    isShared,
    getRooms,
    getActiveRooms,
    getBookings,
    findConflict,
    addRoom,
    deleteRoom,
    addBooking,
    deleteBooking,
    exportWorkbook,
    importWorkbook,
    resetToSeed,
  };
})();
