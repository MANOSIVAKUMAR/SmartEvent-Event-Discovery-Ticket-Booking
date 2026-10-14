import React, { useEffect, useMemo, useState } from "react";
import { createRoot } from "react-dom/client";
import axios from "axios";
import "./style.css";

const API = "http://127.0.0.1:8000";

const api = axios.create({
  baseURL: API,
});

api.interceptors.request.use((config) => {
  const token = localStorage.getItem("token");

  if (token) {
    config.headers.Authorization = `Bearer ${token}`;
  }

  return config;
});

const categoryIcons = {
  Music: "🎵",
  Tech: "💻",
  Sports: "⚽",
  Business: "💼",
};

function eventCategoryClass(categoryName) {
  return (
    categoryName?.toLowerCase().replace(/\s+/g, "-") ||
    "general"
  );
}

function App() {
  const [page, setPage] = useState("home");

  const [token, setToken] = useState(
    localStorage.getItem("token") || ""
  );

  const [username, setUsername] = useState(
    localStorage.getItem("username") || ""
  );

  const [events, setEvents] = useState([]);
  const [bookings, setBookings] = useState([]);
  const [notifications, setNotifications] = useState([]);
  const [dashboard, setDashboard] = useState(null);

  const [selectedEvent, setSelectedEvent] = useState(null);

  const [mobileMenu, setMobileMenu] = useState(false);

  const [search, setSearch] = useState("");
  const [category, setCategory] = useState("All");

  const [loading, setLoading] = useState(false);

  const [message, setMessage] = useState("");
  const [error, setError] = useState("");

  const [registerData, setRegisterData] = useState({
    username: "",
    email: "",
    password: "",
  });

  const [loginData, setLoginData] = useState({
    username: "",
    password: "",
  });

  /*
   * LOAD EVENTS
   */
  useEffect(() => {
    loadEvents();
  }, []);

  /*
   * LOAD USER DATA AFTER LOGIN
   */
  useEffect(() => {
    if (token) {
      loadUserData();
    }
  }, [token]);

  /*
   * LOAD EVENTS
   */
  async function loadEvents() {
    try {
      const response = await api.get("/events");

      setEvents(response.data || []);
    } catch (err) {
      console.error("Events error:", err);

      setError(
        "Unable to connect to the SmartEvent server."
      );
    }
  }

  /*
   * LOAD BOOKINGS + NOTIFICATIONS + DASHBOARD
   */
  async function loadUserData() {
    if (!localStorage.getItem("token")) {
      return;
    }

    try {
      const [bookingRes, notificationRes, dashboardRes] =
        await Promise.all([
          api.get("/bookings"),
          api.get("/notifications"),
          api.get("/dashboard"),
        ]);

      setBookings(bookingRes.data || []);
      setNotifications(notificationRes.data || []);
      setDashboard(dashboardRes.data || null);
    } catch (err) {
      console.error("User data error:", err);

      if (err.response?.status === 401) {
        logout();
      }
    }
  }

  /*
   * CLEAR MESSAGES
   */
  function clearMessages() {
    setMessage("");
    setError("");
  }

  /*
   * NAVIGATION
   */
  function navigate(target) {
    clearMessages();

    setPage(target);
    setMobileMenu(false);

    if (target === "events") {
      loadEvents();
    }

    if (
      token &&
      ["dashboard", "bookings", "notifications"].includes(
        target
      )
    ) {
      loadUserData();
    }
  }

  /*
   * REGISTER
   */
  async function register() {
    clearMessages();

    if (
      !registerData.username.trim() ||
      !registerData.email.trim() ||
      !registerData.password.trim()
    ) {
      setError("Please fill all registration fields.");
      return;
    }

    if (registerData.password.length < 6) {
      setError("Password must contain at least 6 characters.");
      return;
    }

    try {
      setLoading(true);

      await api.post("/auth/register", {
        username: registerData.username.trim(),
        email: registerData.email.trim(),
        password: registerData.password,
      });

      setLoginData({
        username: registerData.username.trim(),
        password: registerData.password,
      });

      setRegisterData({
        username: "",
        email: "",
        password: "",
      });

      setMessage(
        "Registration successful. Please login."
      );

      setPage("login");
    } catch (err) {
      console.error("Register error:", err);

      setError(
        err.response?.data?.detail ||
          "Registration failed."
      );
    } finally {
      setLoading(false);
    }
  }

  /*
   * LOGIN
   *
   * IMPORTANT:
   * Backend expects JSON:
   *
   * {
   *   username: "...",
   *   password: "..."
   * }
   *
   * Backend returns:
   *
   * {
   *   token: "...",
   *   username: "..."
   * }
   */
  async function login() {
    clearMessages();

    if (
      !loginData.username.trim() ||
      !loginData.password.trim()
    ) {
      setError("Please enter username and password.");
      return;
    }

    try {
      setLoading(true);

      const response = await api.post("/auth/login", {
        username: loginData.username.trim(),
        password: loginData.password,
      });

      const newToken = response.data?.token;

      if (!newToken) {
        throw new Error(
          "Token was not returned by the server."
        );
      }

      const loggedUsername =
        response.data?.username ||
        loginData.username.trim();

      localStorage.setItem("token", newToken);
      localStorage.setItem(
        "username",
        loggedUsername
      );

      setToken(newToken);
      setUsername(loggedUsername);

      setMessage("Login successful.");

      /*
       * Token is already stored before loading protected APIs.
       */
      await loadUserData();

      setPage("dashboard");
      setMobileMenu(false);
    } catch (err) {
      console.error(
        "Login error:",
        err.response?.data || err
      );

      setError(
        err.response?.data?.detail ||
          "Login failed. Please check your username and password."
      );
    } finally {
      setLoading(false);
    }
  }

  /*
   * LOGOUT
   */
  function logout() {
    localStorage.removeItem("token");
    localStorage.removeItem("username");

    setToken("");
    setUsername("");

    setBookings([]);
    setNotifications([]);
    setDashboard(null);

    setSelectedEvent(null);

    clearMessages();

    setMessage("Logged out successfully.");

    setPage("home");
    setMobileMenu(false);
  }

  /*
   * FILTER EVENTS
   */
  const filteredEvents = useMemo(() => {
    const searchValue = search.trim().toLowerCase();

    return events.filter((event) => {
      const matchesSearch =
        !searchValue ||
        event.title
          ?.toLowerCase()
          .includes(searchValue) ||
        event.location
          ?.toLowerCase()
          .includes(searchValue) ||
        event.category
          ?.toLowerCase()
          .includes(searchValue);

      const matchesCategory =
        category === "All" ||
        event.category === category;

      return matchesSearch && matchesCategory;
    });
  }, [events, search, category]);

  /*
   * BOOK EVENT
   */
  async function bookEvent(
    eventId,
    quantity,
    couponCode
  ) {
    clearMessages();

    if (!token) {
      setSelectedEvent(null);
      setPage("login");
      setError(
        "Please login before booking an event."
      );
      return;
    }

    if (!quantity || Number(quantity) < 1) {
      setError("Please select at least one ticket.");
      return;
    }

    try {
      setLoading(true);

      const payload = {
        event_id: Number(eventId),
        quantity: Number(quantity),
      };

      if (couponCode?.trim()) {
        payload.coupon_code =
          couponCode.trim().toUpperCase();
      }

      await api.post("/bookings", payload);

      /*
       * Backend creates the booking.
       * Reload bookings so we get its generated ID.
       */
      const bookingResponse = await api.get("/bookings");

      const updatedBookings =
        bookingResponse.data || [];

      setBookings(updatedBookings);

      /*
       * Find latest booking for this event.
       */
      const eventBookings =
        updatedBookings.filter(
          (booking) =>
            Number(booking.event_id) === Number(eventId)
        );

      const latestBooking =
        eventBookings.length > 0
          ? [...eventBookings].sort(
              (a, b) =>
                Number(b.id) - Number(a.id)
            )[0]
          : null;

      setSelectedEvent(null);

      if (latestBooking?.id) {
        /*
         * Open payment modal.
         */
        setPaymentBooking(latestBooking);
      } else {
        setMessage(
          "Booking created successfully."
        );

        setPage("bookings");
      }
    } catch (err) {
      console.error("Booking error:", err);

      setError(
        err.response?.data?.detail ||
          "Booking failed."
      );
    } finally {
      setLoading(false);
    }
  }

  /*
   * PAYMENT BOOKING
   */
  const [paymentBooking, setPaymentBooking] =
    useState(null);

  /*
   * PAYMENT
   */
  async function makePayment(
    bookingId,
    paymentMethod
  ) {
    clearMessages();

    if (!bookingId) {
      setError("Invalid booking.");
      return;
    }

    try {
      setLoading(true);

      await api.post("/payments", {
        booking_id: Number(bookingId),
        payment_method:
          paymentMethod || "SIMULATED_CARD",
        simulate_success: true,
      });

      setPaymentBooking(null);

      await loadUserData();

      setMessage(
        "Payment successful. Your booking is confirmed."
      );

      setPage("bookings");
    } catch (err) {
      console.error("Payment error:", err);

      setError(
        err.response?.data?.detail ||
          "Payment failed."
      );
    } finally {
      setLoading(false);
    }
  }

  /*
   * MARK NOTIFICATION AS READ
   */
  async function markNotificationRead(id) {
    try {
      await api.put(
        `/notifications/${id}/read`
      );

      setNotifications((old) =>
        old.map((item) =>
          item.id === id
            ? {
                ...item,
                is_read: true,
              }
            : item
        )
      );

      setDashboard((old) => {
        if (!old) return old;

        return {
          ...old,
          unread_notifications: Math.max(
            0,
            Number(
              old.unread_notifications || 0
            ) - 1
          ),
        };
      });
    } catch (err) {
      console.error(
        "Notification error:",
        err
      );

      setError(
        err.response?.data?.detail ||
          "Unable to update notification."
      );
    }
  }

  /*
   * PAGE
   */
  return (
    <div className="app">
      <Navbar
        token={token}
        username={username}
        page={page}
        mobileMenu={mobileMenu}
        setMobileMenu={setMobileMenu}
        navigate={navigate}
        logout={logout}
      />

      {message && (
        <div className="toast success-toast">
          <span>✓</span>

          <div>{message}</div>

          <button
            onClick={() => setMessage("")}
          >
            ×
          </button>
        </div>
      )}

      {error && (
        <div className="toast error-toast">
          <span>!</span>

          <div>{error}</div>

          <button
            onClick={() => setError("")}
          >
            ×
          </button>
        </div>
      )}

      {page === "home" && (
        <Home
          events={events}
          navigate={navigate}
          setSelectedEvent={setSelectedEvent}
        />
      )}

      {page === "events" && (
        <EventsPage
          events={filteredEvents}
          search={search}
          setSearch={setSearch}
          category={category}
          setCategory={setCategory}
          loading={loading}
          setSelectedEvent={setSelectedEvent}
        />
      )}

      {page === "login" && (
        <AuthPage
          type="login"
          data={loginData}
          setData={setLoginData}
          submit={login}
          loading={loading}
          navigate={navigate}
        />
      )}

      {page === "register" && (
        <AuthPage
          type="register"
          data={registerData}
          setData={setRegisterData}
          submit={register}
          loading={loading}
          navigate={navigate}
        />
      )}

      {page === "dashboard" && token && (
        <Dashboard
          dashboard={dashboard}
          username={username}
          navigate={navigate}
        />
      )}

      {page === "bookings" && token && (
        <BookingsPage
          bookings={bookings}
          events={events}
          navigate={navigate}
          setPaymentBooking={setPaymentBooking}
        />
      )}

      {page === "notifications" && token && (
        <NotificationsPage
          notifications={notifications}
          markNotificationRead={
            markNotificationRead
          }
        />
      )}

      {page !== "login" &&
        page !== "register" && <Footer />}

      {selectedEvent && (
        <EventModal
          event={selectedEvent}
          close={() => setSelectedEvent(null)}
          bookEvent={bookEvent}
          loading={loading}
          token={token}
          navigate={navigate}
        />
      )}

      {paymentBooking && (
        <PaymentModal
          booking={paymentBooking}
          close={() => setPaymentBooking(null)}
          pay={makePayment}
          loading={loading}
        />
      )}
    </div>
  );
}

/* =====================================================
   NAVBAR
===================================================== */

function Navbar({
  token,
  username,
  page,
  mobileMenu,
  setMobileMenu,
  navigate,
  logout,
}) {
  return (
    <header className="navbar">
      <div className="navbar-inner">
        <button
          className="logo"
          onClick={() => navigate("home")}
        >
          <span className="logo-box">S</span>
          Smart<span className="purple">Event</span>
        </button>

        <nav
          className={`nav-links ${
            mobileMenu ? "mobile-show" : ""
          }`}
        >
          <button
            className={
              page === "home"
                ? "nav-active"
                : ""
            }
            onClick={() => navigate("home")}
          >
            Home
          </button>

          <button
            className={
              page === "events"
                ? "nav-active"
                : ""
            }
            onClick={() => navigate("events")}
          >
            Events
          </button>

          {token && (
            <>
              <button
                className={
                  page === "dashboard"
                    ? "nav-active"
                    : ""
                }
                onClick={() =>
                  navigate("dashboard")
                }
              >
                Dashboard
              </button>

              <button
                className={
                  page === "bookings"
                    ? "nav-active"
                    : ""
                }
                onClick={() =>
                  navigate("bookings")
                }
              >
                My Bookings
              </button>

              <button
                className={
                  page === "notifications"
                    ? "nav-active"
                    : ""
                }
                onClick={() =>
                  navigate("notifications")
                }
              >
                Notifications
              </button>
            </>
          )}
        </nav>

        <div className="nav-right">
          {token ? (
            <>
              <div className="user-circle">
                {username
                  ?.charAt(0)
                  .toUpperCase()}
              </div>

              <button
                className="logout-btn"
                onClick={logout}
              >
                Logout
              </button>
            </>
          ) : (
            <>
              <button
                className="login-btn"
                onClick={() =>
                  navigate("login")
                }
              >
                Login
              </button>

              <button
                className="primary-btn"
                onClick={() =>
                  navigate("register")
                }
              >
                Get Started
              </button>
            </>
          )}

          <button
            className="menu-btn"
            onClick={() =>
              setMobileMenu(!mobileMenu)
            }
          >
            ☰
          </button>
        </div>
      </div>
    </header>
  );
}

/* =====================================================
   HOME
===================================================== */

function Home({
  events,
  navigate,
  setSelectedEvent,
}) {
  const featured = events[0];

  return (
    <>
      <section className="hero">
        <div className="hero-left">
          <span className="hero-badge">
            DISCOVER • EXPERIENCE • REMEMBER
          </span>

          <h1>
            Your next
            <br />
            <span>great experience</span>
            <br />
            starts here.
          </h1>

          <p>
            Discover amazing events, connect
            with people, and book unforgettable
            experiences with SmartEvent.
          </p>

          <div className="hero-buttons">
            <button
              className="primary-btn"
              onClick={() =>
                navigate("events")
              }
            >
              Explore Events →
            </button>

            <button
              className="secondary-btn"
              onClick={() =>
                navigate("register")
              }
            >
              Create Account
            </button>
          </div>

          <div className="hero-stats">
            <div>
              <strong>50+</strong>
              <span>Events</span>
            </div>

            <div>
              <strong>10K+</strong>
              <span>Attendees</span>
            </div>

            <div>
              <strong>4.9/5</strong>
              <span>Rating</span>
            </div>
          </div>
        </div>

        <div className="hero-right">
          {featured ? (
            <div className="hero-event-card">
              <div
                className={`hero-event-image ${eventCategoryClass(
                  featured.category
                )}`}
              >
                {categoryIcons[
                  featured.category
                ] || "🎫"}
              </div>

              <div className="hero-event-content">
                <span className="event-tag">
                  Featured Event
                </span>

                <h3>{featured.title}</h3>

                <p>
                  📍{" "}
                  {featured.location ||
                    "Location"}
                </p>

                <p>
                  📅{" "}
                  {featured.start_date
                    ? new Date(
                        featured.start_date
                      ).toLocaleDateString()
                    : "Date"}
                </p>

                <div className="hero-price">
                  <strong>
                    ₹
                    {Number(
                      featured.price || 0
                    ).toFixed(0)}
                  </strong>

                  <button
                    onClick={() =>
                      setSelectedEvent(
                        featured
                      )
                    }
                  >
                    View Event →
                  </button>
                </div>
              </div>
            </div>
          ) : (
            <div className="hero-event-card">
              <div className="hero-event-image">
                🎟️
              </div>

              <div className="hero-event-content">
                <h3>
                  Discover Your Next Event
                </h3>

                <p>
                  Explore amazing events with
                  SmartEvent.
                </p>
              </div>
            </div>
          )}
        </div>
      </section>

      <section className="section">
        <div className="section-title">
          <div>
            <span>EXPLORE</span>
            <h2>Event Categories</h2>
          </div>
        </div>

        <div className="category-grid">
          {[
            [
              "Music",
              "🎵",
              "Live music & concerts",
            ],
            [
              "Tech",
              "💻",
              "Technology & innovation",
            ],
            [
              "Sports",
              "⚽",
              "Sports & competitions",
            ],
            [
              "Business",
              "💼",
              "Business & networking",
            ],
          ].map(
            ([name, icon, text]) => (
              <button
                className="category-card"
                key={name}
                onClick={() => {
                  navigate("events");
                }}
              >
                <div>{icon}</div>

                <strong>{name}</strong>

                <span>{text}</span>
              </button>
            )
          )}
        </div>
      </section>

      <section className="section light-section">
        <div className="section-title">
          <div>
            <span>DON'T MISS OUT</span>
            <h2>Popular Events</h2>
          </div>

          <button
            className="view-all"
            onClick={() =>
              navigate("events")
            }
          >
            View all →
          </button>
        </div>

        <EventGrid
          events={events.slice(0, 4)}
          setSelectedEvent={
            setSelectedEvent
          }
        />
      </section>
    </>
  );
}

/* =====================================================
   EVENTS PAGE
===================================================== */

function EventsPage({
  events,
  search,
  setSearch,
  category,
  setCategory,
  loading,
  setSelectedEvent,
}) {
  return (
    <main className="page-section">
      <div className="page-heading">
        <span>DISCOVER</span>

        <h1>Find your next event</h1>

        <p>
          Search and explore events that match
          your interests.
        </p>
      </div>

      <div className="search-area">
        <input
          type="search"
          placeholder="Search events, locations or categories..."
          value={search}
          onChange={(e) =>
            setSearch(e.target.value)
          }
        />
      </div>

      <div className="filter-buttons">
        {[
          "All",
          "Music",
          "Tech",
          "Sports",
          "Business",
        ].map((item) => (
          <button
            key={item}
            className={
              category === item
                ? "filter-active"
                : ""
            }
            onClick={() =>
              setCategory(item)
            }
          >
            {item}
          </button>
        ))}
      </div>

      {loading ? (
        <div className="loading">
          Loading events...
        </div>
      ) : events.length === 0 ? (
        <div className="empty">
          <div>🔎</div>

          <h3>No events found</h3>

          <p>
            Try another search or category.
          </p>
        </div>
      ) : (
        <EventGrid
          events={events}
          setSelectedEvent={
            setSelectedEvent
          }
        />
      )}
    </main>
  );
}

/* =====================================================
   EVENT GRID
===================================================== */

function EventGrid({
  events,
  setSelectedEvent,
}) {
  if (!events.length) {
    return (
      <div className="empty">
        <div>🎫</div>

        <h3>No events available</h3>

        <p>Check again later.</p>
      </div>
    );
  }

  return (
    <div className="event-grid">
      {events.map((event) => (
        <article
          className="event-card"
          key={event.id}
        >
          <div
            className={`event-image ${eventCategoryClass(
              event.category
            )}`}
          >
            <span>
              {categoryIcons[
                event.category
              ] || "🎫"}
            </span>

            <small>
              {event.category}
            </small>
          </div>

          <div className="event-card-body">
            <span className="event-date">
              {event.start_date
                ? new Date(
                    event.start_date
                  ).toLocaleDateString()
                : "Date unavailable"}
            </span>

            <h3>{event.title}</h3>

            <p>
              📍{" "}
              {event.location ||
                "Location unavailable"}
            </p>

            <div className="event-bottom">
              <strong>
                ₹
                {Number(
                  event.price || 0
                ).toFixed(0)}
              </strong>

              <button
                onClick={() =>
                  setSelectedEvent(event)
                }
              >
                View Details →
              </button>
            </div>
          </div>
        </article>
      ))}
    </div>
  );
}

/* =====================================================
   AUTH PAGE
===================================================== */

function AuthPage({
  type,
  data,
  setData,
  submit,
  loading,
  navigate,
}) {
  const registerMode =
    type === "register";

  return (
    <main className="auth-page">
      <div className="auth-card">
        <div className="auth-logo">
          <span className="logo-box">S</span>

          Smart
          <span className="purple">
            Event
          </span>
        </div>

        <span>
          {registerMode
            ? "JOIN SMART EVENT"
            : "WELCOME BACK"}
        </span>

        <h1>
          {registerMode
            ? "Create your account"
            : "Welcome back"}
        </h1>

        <p>
          {registerMode
            ? "Create an account and start discovering amazing events."
            : "Login to manage your bookings and discover new events."}
        </p>

        <form
          onSubmit={(e) => {
            e.preventDefault();
            submit();
          }}
        >
          <label>
            Username

            <input
              type="text"
              placeholder="Enter username"
              value={data.username}
              onChange={(e) =>
                setData({
                  ...data,
                  username:
                    e.target.value,
                })
              }
              autoComplete="username"
            />
          </label>

          {registerMode && (
            <label>
              Email

              <input
                type="email"
                placeholder="Enter email"
                value={data.email}
                onChange={(e) =>
                  setData({
                    ...data,
                    email:
                      e.target.value,
                  })
                }
                autoComplete="email"
              />
            </label>
          )}

          <label>
            Password

            <input
              type="password"
              placeholder="Enter password"
              value={data.password}
              onChange={(e) =>
                setData({
                  ...data,
                  password:
                    e.target.value,
                })
              }
              autoComplete={
                registerMode
                  ? "new-password"
                  : "current-password"
              }
            />
          </label>

          <button
            className="primary-btn full"
            type="submit"
            disabled={loading}
          >
            {loading
              ? "Please wait..."
              : registerMode
              ? "Create Account"
              : "Login"}
          </button>
        </form>

        <p className="auth-switch">
          {registerMode
            ? "Already have an account?"
            : "Don't have an account?"}{" "}

          <button
            type="button"
            className="link-btn"
            onClick={() =>
              navigate(
                registerMode
                  ? "login"
                  : "register"
              )
            }
          >
            {registerMode
              ? "Login"
              : "Register"}
          </button>
        </p>
      </div>
    </main>
  );
}

/* =====================================================
   DASHBOARD
===================================================== */

function Dashboard({
  dashboard,
  username,
  navigate,
}) {
  return (
    <main className="page-section">
      <div className="page-heading">
        <span>YOUR SPACE</span>

        <h1>
          Hello, {username || "User"} 👋
        </h1>

        <p>
          Here is your SmartEvent activity
          overview.
        </p>
      </div>

      <div className="stats-grid">
        <StatCard
          icon="🎟️"
          label="Total Bookings"
          value={
            dashboard?.total_bookings ?? 0
          }
        />

        <StatCard
          icon="✓"
          label="Confirmed"
          value={
            dashboard?.confirmed_bookings ?? 0
          }
        />

        <StatCard
          icon="₹"
          label="Total Spent"
          value={`₹${Number(
            dashboard?.total_spent || 0
          ).toFixed(2)}`}
        />

        <StatCard
          icon="🔔"
          label="Unread"
          value={
            dashboard?.unread_notifications ??
            0
          }
        />
      </div>

      <div className="dashboard-actions">
        <button
          className="primary-btn"
          onClick={() =>
            navigate("events")
          }
        >
          Explore Events
        </button>

        <button
          className="secondary-light-btn"
          onClick={() =>
            navigate("bookings")
          }
        >
          My Bookings
        </button>

        <button
          className="secondary-light-btn"
          onClick={() =>
            navigate("notifications")
          }
        >
          Notifications
        </button>
      </div>
    </main>
  );
}

function StatCard({
  icon,
  label,
  value,
}) {
  return (
    <div className="stat-card">
      <div className="stat-icon">
        {icon}
      </div>

      <div>
        <span>{label}</span>

        <strong>{value}</strong>
      </div>
    </div>
  );
}

/* =====================================================
   BOOKINGS
===================================================== */

function BookingsPage({
  bookings,
  events,
  navigate,
  setPaymentBooking,
}) {
  const getEvent = (id) =>
    events.find(
      (event) =>
        Number(event.id) === Number(id)
    );

  return (
    <main className="page-section">
      <div className="page-heading">
        <span>YOUR TICKETS</span>

        <h1>My Bookings</h1>

        <p>
          Manage your event bookings and
          payments.
        </p>
      </div>

      {bookings.length === 0 ? (
        <div className="empty">
          <div>🎟️</div>

          <h3>No bookings yet</h3>

          <p>
            Book your first event to see it
            here.
          </p>

          <button
            className="primary-btn"
            onClick={() =>
              navigate("events")
            }
          >
            Explore Events
          </button>
        </div>
      ) : (
        <div className="booking-list">
          {bookings.map((booking) => {
            const event = getEvent(
              booking.event_id
            );

            const amount = Number(
              booking.final_amount ??
                booking.total_amount ??
                0
            );

            return (
              <div
                className="booking-card"
                key={booking.id}
              >
                <div>
                  <span>
                    BOOKING #{booking.id}
                  </span>

                  <h3>
                    {event?.title ||
                      `Event #${booking.event_id}`}
                  </h3>

                  <p>
                    Tickets:{" "}
                    {booking.quantity}
                  </p>

                  <p>
                    Amount: ₹
                    {amount.toFixed(2)}
                  </p>

                  {booking.created_at && (
                    <p>
                      Date:{" "}
                      {new Date(
                        booking.created_at
                      ).toLocaleString()}
                    </p>
                  )}
                </div>

                <div className="booking-right">
                  <span
                    className={`status ${
                      booking.status?.toLowerCase() ||
                      "pending"
                    }`}
                  >
                    {booking.status ||
                      "PENDING"}
                  </span>

                  <strong>
                    ₹{amount.toFixed(2)}
                  </strong>

                  {booking.status ===
                    "PENDING" && (
                    <button
                      className="primary-btn"
                      onClick={() =>
                        setPaymentBooking(
                          booking
                        )
                      }
                    >
                      Pay Now
                    </button>
                  )}
                </div>
              </div>
            );
          })}
        </div>
      )}
    </main>
  );
}

/* =====================================================
   NOTIFICATIONS
===================================================== */

function NotificationsPage({
  notifications,
  markNotificationRead,
}) {
  return (
    <main className="page-section">
      <div className="page-heading">
        <span>UPDATES</span>

        <h1>Notifications</h1>

        <p>
          Stay updated with your SmartEvent
          activity.
        </p>
      </div>

      {notifications.length === 0 ? (
        <div className="empty">
          <div>🔔</div>

          <h3>No notifications</h3>

          <p>
            You are all caught up.
          </p>
        </div>
      ) : (
        <div className="notification-list">
          {notifications.map(
            (notification) => (
              <div
                className={`notification-card ${
                  notification.is_read
                    ? "read"
                    : "unread"
                }`}
                key={notification.id}
              >
                <div className="notification-icon">
                  {notification.notification_type ===
                  "PAYMENT"
                    ? "💳"
                    : "🎟️"}
                </div>

                <div className="notification-content">
                  <strong>
                    {notification.title}
                  </strong>

                  <p>
                    {notification.message}
                  </p>

                  <small>
                    {notification.created_at
                      ? new Date(
                          notification.created_at
                        ).toLocaleString()
                      : ""}
                  </small>
                </div>

                {!notification.is_read && (
                  <button
                    className="mark-read"
                    onClick={() =>
                      markNotificationRead(
                        notification.id
                      )
                    }
                  >
                    Mark read
                  </button>
                )}
              </div>
            )
          )}
        </div>
      )}
    </main>
  );
}

/* =====================================================
   EVENT MODAL
===================================================== */

function EventModal({
  event,
  close,
  bookEvent,
  loading,
  token,
  navigate,
}) {
  const [quantity, setQuantity] =
    useState(1);

  const [coupon, setCoupon] =
    useState("");

  const price = Number(
    event.price || 0
  );

  const total = price * quantity;

  return (
    <div
      className="modal-overlay"
      onMouseDown={close}
    >
      <div
        className="event-modal"
        onMouseDown={(e) =>
          e.stopPropagation()
        }
      >
        <button
          className="close-modal"
          onClick={close}
          type="button"
        >
          ×
        </button>

        <div
          className={`modal-image ${eventCategoryClass(
            event.category
          )}`}
        >
          {categoryIcons[
            event.category
          ] || "🎫"}
        </div>

        <div className="modal-content">
          <span className="event-tag">
            {event.category}
          </span>

          <h2>{event.title}</h2>

          <p>
            📍{" "}
            {event.location ||
              "Location unavailable"}
          </p>

          <p>
            📅{" "}
            {event.start_date
              ? new Date(
                  event.start_date
                ).toLocaleString()
              : "Date unavailable"}
          </p>

          <p className="description">
            {event.description ||
              "Join this exciting event and enjoy an unforgettable experience."}
          </p>

          <div className="booking-box">
            <div className="quantity">
              <strong>
                Tickets
              </strong>

              <div>
                <button
                  type="button"
                  onClick={() =>
                    setQuantity(
                      Math.max(
                        1,
                        quantity - 1
                      )
                    )
                  }
                >
                  −
                </button>

                <strong>
                  {quantity}
                </strong>

                <button
                  type="button"
                  onClick={() =>
                    setQuantity(
                      quantity + 1
                    )
                  }
                >
                  +
                </button>
              </div>
            </div>

            <input
              type="text"
              placeholder="Coupon code (optional)"
              value={coupon}
              onChange={(e) =>
                setCoupon(e.target.value)
              }
            />

            <div className="modal-total">
              <span>Total</span>

              <strong>
                ₹{total.toFixed(2)}
              </strong>
            </div>

            {!token ? (
              <button
                className="primary-btn full"
                type="button"
                onClick={() => {
                  close();
                  navigate("login");
                }}
              >
                Login to Book
              </button>
            ) : (
              <button
                className="primary-btn full"
                type="button"
                disabled={loading}
                onClick={() =>
                  bookEvent(
                    event.id,
                    quantity,
                    coupon
                  )
                }
              >
                {loading
                  ? "Booking..."
                  : "Book Tickets"}
              </button>
            )}
          </div>
        </div>
      </div>
    </div>
  );
}

/* =====================================================
   PAYMENT MODAL
===================================================== */

function PaymentModal({
  booking,
  close,
  pay,
  loading,
}) {
  const amount = Number(
    booking?.final_amount ??
      booking?.total_amount ??
      0
  );

  return (
    <div
      className="modal-overlay"
      onMouseDown={close}
    >
      <div
        className="event-modal payment-modal"
        onMouseDown={(e) =>
          e.stopPropagation()
        }
      >
        <button
          className="close-modal"
          onClick={close}
          type="button"
        >
          ×
        </button>

        <div className="modal-content">
          <div className="payment-icon">
            💳
          </div>

          <span className="event-tag">
            SECURE PAYMENT
          </span>

          <h2>
            Complete your payment
          </h2>

          <p>
            Your booking has been created.
            Complete the simulated payment
            to confirm your ticket.
          </p>

          <div className="payment-summary">
            <div>
              <span>Booking ID</span>

              <strong>
                #{booking?.id}
              </strong>
            </div>

            <div>
              <span>Tickets</span>

              <strong>
                {booking?.quantity || 0}
              </strong>
            </div>

            <div>
              <span>Total</span>

              <strong>
                ₹{amount.toFixed(2)}
              </strong>
            </div>
          </div>

          <button
            className="primary-btn full"
            type="button"
            disabled={loading}
            onClick={() =>
              pay(
                booking.id,
                "SIMULATED_CARD"
              )
            }
          >
            {loading
              ? "Processing..."
              : `Pay ₹${amount.toFixed(2)}`}
          </button>

          <p className="payment-note">
            This is a simulated payment for
            project demonstration.
          </p>
        </div>
      </div>
    </div>
  );
}

/* =====================================================
   FOOTER
===================================================== */

function Footer() {
  return (
    <footer className="footer">
      <div>
        <div className="auth-logo">
          <span className="logo-box">
            S
          </span>

          Smart
          <span className="purple">
            Event
          </span>
        </div>

        <p>
          Discover. Experience. Remember.
        </p>
      </div>

      <p>
        © 2026 SmartEvent. All rights reserved.
      </p>
    </footer>
  );
}

/* =====================================================
   START APPLICATION
===================================================== */

createRoot(
  document.getElementById("root")
).render(
  <React.StrictMode>
    <App />
  </React.StrictMode>
);