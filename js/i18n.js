/*
 * i18n.js — English / Portuguese switcher.
 *
 * Static text: tag elements with data-i18n="key" (textContent),
 *   data-i18n-ph="key" (placeholder) or data-i18n-title="key" (title).
 * Dynamic text (in JS): use I18N.t("key", { var: value }).
 * On change, a "languagechange" event fires so pages can re-render lists.
 */
const I18N = (() => {
  const KEY = "mrb_lang";

  const dict = {
    en: {
      // common
      "brand": "Meeting Room Booking (PPB Mozambique)",
      "nav.book": "Book a Room",
      "nav.admin": "Admin",
      "nav.users": "Users",
      "nav.history": "History",
      "btn.logout": "Logout",

      // index
      "title.book": "Book a Room",
      "sub.book": "Pick a room, choose a time slot and reserve it. Only one meeting can be booked per time slot — overlapping times are blocked.",
      "card.newBooking": "New Booking",
      "label.room": "Meeting Room",
      "label.title": "Meeting Title",
      "ph.title": "e.g. Sprint Planning",
      "label.bookedBy": "Booking as",
      "label.date": "Date",
      "label.start": "Start",
      "label.end": "End",
      "btn.reserve": "Reserve Room",
      "btn.reserving": "Reserving…",
      "card.availableRooms": "Available Rooms",
      "card.upcoming": "Upcoming Bookings",
      "th.room": "Room",
      "th.meeting": "Meeting",
      "th.by": "By",
      "th.date": "Date",
      "th.time": "Time",
      "modal.cancelTitle": "Cancel meeting",
      "modal.cancelSub": "Tell everyone why this meeting is being cancelled.",
      "label.reason": "Reason",
      "ph.reason": "e.g. Rescheduled to next week",
      "btn.keep": "Keep meeting",
      "btn.cancelMeeting": "Cancel meeting",
      "msg.addRoomFirst": "Please add a room first.",
      "msg.booked": "Room booked.",
      "empty.noUpcoming": "No upcoming meetings.",
      "empty.noRooms": "No rooms available. Ask an admin to add one.",
      "seats": "seats",
      "sugg.freeRooms": "Free rooms at the same time:",
      "sugg.tryTimes": "Or try another free time:",
      "sugg.none": "No free alternatives found that day (08:00–18:00).",
      "cancel.reasonRequired": "A reason is required to cancel.",
      "cancel.confirmTitle": "Cancel this meeting?",

      // admin
      "title.admin": "Manage Rooms",
      "sub.admin": "Add, edit, activate or remove meeting rooms.",
      "card.addRoom": "Add a Room",
      "label.name": "Name",
      "label.location": "Location",
      "label.capacity": "Capacity",
      "label.facilities": "Facilities",
      "ph.facilities": "e.g. Projector, Whiteboard",
      "btn.addRoom": "Add Room",
      "card.rooms": "Rooms",
      "th.name": "Name",
      "th.location": "Location",
      "th.seats": "Seats",
      "th.facilities": "Facilities",
      "th.status": "Status",
      "th.actions": "Actions",
      "btn.edit": "Edit",
      "btn.save": "Save",
      "btn.cancel": "Cancel",
      "btn.activate": "Activate",
      "btn.deactivate": "Deactivate",
      "status.active": "Active",
      "status.inactive": "Inactive",
      "empty.noRoomsAdmin": "No rooms yet. Add your first one on the left.",

      // users
      "title.users": "Users",
      "sub.users": "Create accounts and control who can access the system. Only admins can open this page.",
      "card.createUser": "Create a User",
      "label.fullName": "Full name",
      "label.username": "Username",
      "label.email": "Email",
      "label.tempPassword": "Temporary password",
      "label.role": "Role",
      "opt.roleUser": "User — can book rooms",
      "opt.roleAdmin": "Admin — can manage rooms & users",
      "btn.createUser": "Create User",
      "card.existingUsers": "Existing Users",
      "th.username": "Username",
      "th.email": "Email",
      "th.role": "Role",
      "btn.resetPw": "Reset PW",
      "btn.disable": "Disable",
      "btn.enable": "Enable",
      "status.disabled": "Disabled",
      "tag.you": "you",
      "tag.tempPw": "temp pw",

      // history
      "title.history": "Meeting History",
      "sub.history": "Meetings that have already taken place or were cancelled — for reporting. Newest first.",
      "filter.from": "From",
      "filter.to": "To",
      "btn.clear": "Clear",
      "btn.exportCsv": "Download CSV",
      "th.bookedBy": "Booked by",
      "th.cancelledBy": "Cancelled by",
      "th.reason": "Reason",
      "status.held": "Held",
      "status.cancelled": "Cancelled",
      "history.count": "{total} total · {cancelled} cancelled",
      "history.empty": "No meetings for this range.",

      // login / reset
      "title.signin": "Sign in",
      "sub.signin": "Enter your credentials to continue.",
      "ph.usernameEg": "e.g. slanga",
      "label.password": "Password",
      "btn.signin": "Sign in",
      "loading": "Loading…",
      "title.firstAdmin": "Create the first admin",
      "sub.firstAdmin": "No accounts exist yet. The first account becomes the administrator.",
      "btn.createAdmin": "Create admin & continue",
      "msg.pleaseWait": "Please wait…",
      "msg.idleLogout": "You were signed out after 15 minutes of inactivity.",
      "title.resetPw": "Set a new password",
      "sub.resetPw": "Choose a new password to finish signing in.",
      "label.newPassword": "New password",
      "label.confirmPassword": "Confirm password",
      "btn.savePassword": "Save & continue",
    },

    pt: {
      "brand": "Reserva de Salas (PPB Moçambique)",
      "nav.book": "Reservar Sala",
      "nav.admin": "Admin",
      "nav.users": "Utilizadores",
      "nav.history": "Histórico",
      "btn.logout": "Sair",

      "title.book": "Reservar Sala",
      "sub.book": "Escolha uma sala, selecione um horário e reserve. Só pode existir uma reunião por horário — horários sobrepostos são bloqueados.",
      "card.newBooking": "Nova Reserva",
      "label.room": "Sala de Reunião",
      "label.title": "Título da Reunião",
      "ph.title": "ex.: Planeamento de Sprint",
      "label.bookedBy": "A reservar como",
      "label.date": "Data",
      "label.start": "Início",
      "label.end": "Fim",
      "btn.reserve": "Reservar Sala",
      "btn.reserving": "A reservar…",
      "card.availableRooms": "Salas Disponíveis",
      "card.upcoming": "Próximas Reservas",
      "th.room": "Sala",
      "th.meeting": "Reunião",
      "th.by": "Por",
      "th.date": "Data",
      "th.time": "Hora",
      "modal.cancelTitle": "Cancelar reunião",
      "modal.cancelSub": "Indique o motivo do cancelamento desta reunião.",
      "label.reason": "Motivo",
      "ph.reason": "ex.: Remarcado para a próxima semana",
      "btn.keep": "Manter reunião",
      "btn.cancelMeeting": "Cancelar reunião",
      "msg.addRoomFirst": "Primeiro adicione uma sala.",
      "msg.booked": "Sala reservada.",
      "empty.noUpcoming": "Sem reuniões futuras.",
      "empty.noRooms": "Nenhuma sala disponível. Peça a um administrador para adicionar.",
      "seats": "lugares",
      "sugg.freeRooms": "Salas livres no mesmo horário:",
      "sugg.tryTimes": "Ou tente outro horário livre:",
      "sugg.none": "Sem alternativas livres nesse dia (08:00–18:00).",
      "cancel.reasonRequired": "É necessário um motivo para cancelar.",
      "cancel.confirmTitle": "Cancelar esta reunião?",

      "title.admin": "Gerir Salas",
      "sub.admin": "Adicione, edite, ative ou remova salas de reunião.",
      "card.addRoom": "Adicionar Sala",
      "label.name": "Nome",
      "label.location": "Localização",
      "label.capacity": "Capacidade",
      "label.facilities": "Recursos",
      "ph.facilities": "ex.: Projetor, Quadro",
      "btn.addRoom": "Adicionar Sala",
      "card.rooms": "Salas",
      "th.name": "Nome",
      "th.location": "Localização",
      "th.seats": "Lugares",
      "th.facilities": "Recursos",
      "th.status": "Estado",
      "th.actions": "Ações",
      "btn.edit": "Editar",
      "btn.save": "Guardar",
      "btn.cancel": "Cancelar",
      "btn.activate": "Ativar",
      "btn.deactivate": "Desativar",
      "status.active": "Ativa",
      "status.inactive": "Inativa",
      "empty.noRoomsAdmin": "Ainda não há salas. Adicione a primeira à esquerda.",

      "title.users": "Utilizadores",
      "sub.users": "Crie contas e controle quem pode aceder ao sistema. Só administradores podem abrir esta página.",
      "card.createUser": "Criar Utilizador",
      "label.fullName": "Nome completo",
      "label.username": "Nome de utilizador",
      "label.email": "Email",
      "label.tempPassword": "Palavra-passe temporária",
      "label.role": "Função",
      "opt.roleUser": "Utilizador — pode reservar salas",
      "opt.roleAdmin": "Admin — pode gerir salas e utilizadores",
      "btn.createUser": "Criar Utilizador",
      "card.existingUsers": "Utilizadores Existentes",
      "th.username": "Utilizador",
      "th.email": "Email",
      "th.role": "Função",
      "btn.resetPw": "Repor PW",
      "btn.disable": "Desativar",
      "btn.enable": "Ativar",
      "status.disabled": "Desativado",
      "tag.you": "você",
      "tag.tempPw": "pw temp",

      "title.history": "Histórico de Reuniões",
      "sub.history": "Reuniões já realizadas ou canceladas — para relatórios. Mais recentes primeiro.",
      "filter.from": "De",
      "filter.to": "Até",
      "btn.clear": "Limpar",
      "btn.exportCsv": "Descarregar CSV",
      "th.bookedBy": "Reservado por",
      "th.cancelledBy": "Cancelado por",
      "th.reason": "Motivo",
      "status.held": "Realizada",
      "status.cancelled": "Cancelada",
      "history.count": "{total} no total · {cancelled} canceladas",
      "history.empty": "Sem reuniões neste período.",

      "title.signin": "Entrar",
      "sub.signin": "Introduza as suas credenciais para continuar.",
      "ph.usernameEg": "ex.: slanga",
      "label.password": "Palavra-passe",
      "btn.signin": "Entrar",
      "loading": "A carregar…",
      "title.firstAdmin": "Criar o primeiro administrador",
      "sub.firstAdmin": "Ainda não existem contas. A primeira conta torna-se administradora.",
      "btn.createAdmin": "Criar administrador e continuar",
      "msg.pleaseWait": "Aguarde…",
      "msg.idleLogout": "A sua sessão terminou após 15 minutos de inatividade.",
      "title.resetPw": "Definir nova palavra-passe",
      "sub.resetPw": "Escolha uma nova palavra-passe para concluir o início de sessão.",
      "label.newPassword": "Nova palavra-passe",
      "label.confirmPassword": "Confirmar palavra-passe",
      "btn.savePassword": "Guardar e continuar",
    },
  };

  let lang = localStorage.getItem(KEY) === "pt" ? "pt" : "en";

  function t(key, vars) {
    let s = (dict[lang] && dict[lang][key]) || dict.en[key] || key;
    if (vars) for (const k in vars) s = s.split("{" + k + "}").join(vars[k]);
    return s;
  }

  function apply(root) {
    const r = root || document;
    r.querySelectorAll("[data-i18n]").forEach((el) => { el.textContent = t(el.getAttribute("data-i18n")); });
    r.querySelectorAll("[data-i18n-ph]").forEach((el) => { el.setAttribute("placeholder", t(el.getAttribute("data-i18n-ph"))); });
    r.querySelectorAll("[data-i18n-title]").forEach((el) => { el.setAttribute("title", t(el.getAttribute("data-i18n-title"))); });
    document.documentElement.lang = lang;
    updateToggle();
  }

  function updateToggle() {
    document.querySelectorAll(".lang-toggle").forEach((b) => {
      b.textContent = lang === "en" ? "PT" : "EN";
      b.title = lang === "en" ? "Mudar para Português" : "Switch to English";
    });
  }

  function set(l) {
    lang = l === "pt" ? "pt" : "en";
    localStorage.setItem(KEY, lang);
    apply();
    window.dispatchEvent(new CustomEvent("languagechange", { detail: { lang } }));
  }

  const toggle = () => set(lang === "en" ? "pt" : "en");
  const current = () => lang;

  document.addEventListener("DOMContentLoaded", () => {
    apply();
    document.querySelectorAll(".lang-toggle").forEach((b) => b.addEventListener("click", toggle));
  });

  return { t, apply, set, toggle, current };
})();
