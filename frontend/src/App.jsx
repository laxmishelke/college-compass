import { Heart, LogOut, Search, ShieldCheck } from 'lucide-react';
import { createContext, useContext, useEffect, useMemo, useState } from 'react';
import { Link, Navigate, NavLink, Route, Routes, useLocation, useNavigate, useParams } from 'react-router-dom';
import { api } from './api.js';

const AuthContext = createContext(null);
const CompareContext = createContext(null);
const SavedContext = createContext(null);

function currency(value) {
  if (value == null) return 'Not listed';
  return new Intl.NumberFormat('en-IN', {
    style: 'currency',
    currency: 'INR',
    maximumFractionDigits: 0
  }).format(value);
}

function useAuth() {
  return useContext(AuthContext);
}

function useCompare() {
  return useContext(CompareContext);
}

function useSavedColleges() {
  return useContext(SavedContext);
}

function AuthProvider({ children }) {
  const [user, setUser] = useState(() => {
    const stored = localStorage.getItem('collegeCompassUser');
    return stored ? JSON.parse(stored) : null;
  });
  const [authLoading, setAuthLoading] = useState(() => Boolean(localStorage.getItem('collegeCompassToken')));

  useEffect(() => {
    const token = localStorage.getItem('collegeCompassToken');
    const controller = new AbortController();

    if (!token) {
      setAuthLoading(false);
      return () => controller.abort();
    }

    api
      .me({ signal: controller.signal })
      .then((data) => {
        localStorage.setItem('collegeCompassUser', JSON.stringify(data.user));
        setUser(data.user);
      })
      .catch((err) => {
        if (!err.isCanceled) {
          localStorage.removeItem('collegeCompassToken');
          localStorage.removeItem('collegeCompassUser');
          setUser(null);
        }
      })
      .finally(() => {
        if (!controller.signal.aborted) setAuthLoading(false);
      });

    return () => controller.abort();
  }, []);

  const login = ({ token, user: nextUser }) => {
    localStorage.setItem('collegeCompassToken', token);
    localStorage.setItem('collegeCompassUser', JSON.stringify(nextUser));
    setUser(nextUser);
  };

  const logout = () => {
    localStorage.removeItem('collegeCompassToken');
    localStorage.removeItem('collegeCompassUser');
    setUser(null);
  };

  const value = useMemo(() => ({ user, authLoading, login, logout }), [authLoading, user]);

  return <AuthContext.Provider value={value}>{children}</AuthContext.Provider>;
}

function CompareProvider({ children }) {
  const [ids, setIds] = useState(() => {
    const stored = localStorage.getItem('collegeCompareIds');
    return stored ? JSON.parse(stored) : [];
  });

  useEffect(() => {
    localStorage.setItem('collegeCompareIds', JSON.stringify(ids));
  }, [ids]);

  const toggle = (id) => {
    setIds((current) => {
      if (current.includes(id)) return current.filter((item) => item !== id);
      if (current.length >= 3) return current;
      return [...current, id];
    });
  };

  const clear = () => setIds([]);
  const value = useMemo(() => ({ ids, toggle, clear }), [ids]);

  return <CompareContext.Provider value={value}>{children}</CompareContext.Provider>;
}

function SavedProvider({ children }) {
  const { user, authLoading } = useAuth();
  const [savedIds, setSavedIds] = useState([]);
  const [savedLoading, setSavedLoading] = useState(false);
  const [savedError, setSavedError] = useState('');

  useEffect(() => {
    const controller = new AbortController();

    if (authLoading) {
      return () => controller.abort();
    }

    if (!user) {
      setSavedIds([]);
      setSavedError('');
      setSavedLoading(false);
      return () => controller.abort();
    }

    setSavedLoading(true);
    api
      .getSavedColleges({ signal: controller.signal })
      .then((data) => {
        setSavedIds(data.savedIds || []);
        setSavedError('');
      })
      .catch((err) => {
        if (!err.isCanceled) setSavedError(err.message);
      })
      .finally(() => {
        if (!controller.signal.aborted) setSavedLoading(false);
      });

    return () => controller.abort();
  }, [authLoading, user]);

  const toggleSaved = async (collegeId) => {
    if (!user) {
      throw new Error('Please login to save colleges.');
    }

    const wasSaved = savedIds.includes(collegeId);
    setSavedIds((current) => (
      wasSaved ? current.filter((id) => id !== collegeId) : [...current, collegeId]
    ));

    try {
      if (wasSaved) {
        await api.unsaveCollege(collegeId);
      } else {
        await api.saveCollege(collegeId);
      }
      setSavedError('');
    } catch (error) {
      setSavedIds((current) => (
        wasSaved ? [...current, collegeId] : current.filter((id) => id !== collegeId)
      ));
      setSavedError(error.message);
      throw error;
    }
  };

  const value = useMemo(
    () => ({ savedIds, savedLoading, savedError, toggleSaved }),
    [savedError, savedIds, savedLoading]
  );

  return <SavedContext.Provider value={value}>{children}</SavedContext.Provider>;
}

function Layout() {
  const { user, logout } = useAuth();

  return (
    <div>
      <header className="topbar">
        <Link to="/" className="brand">
          <ShieldCheck size={24} />
          College Compass
        </Link>
        <nav>
          <NavLink to="/">Colleges</NavLink>
          {user && <NavLink to="/saved">Saved</NavLink>}
          <NavLink to="/compare">Compare</NavLink>
          {user ? (
            <button className="iconTextButton" onClick={logout}>
              <LogOut size={17} />
              {user.name}
            </button>
          ) : (
            <>
              <NavLink to="/login">Login</NavLink>
              <NavLink to="/signup">Sign up</NavLink>
            </>
          )}
        </nav>
      </header>
      <main>
        <Routes>
          <Route path="/" element={<CollegeList />} />
          <Route path="/colleges/:id" element={<CollegeDetail />} />
          <Route path="/saved" element={<ProtectedRoute><SavedCollegesPage /></ProtectedRoute>} />
          <Route path="/compare" element={<ProtectedRoute><ComparePage /></ProtectedRoute>} />
          <Route path="/login" element={<LoginPage />} />
          <Route path="/signup" element={<SignupPage />} />
          <Route path="*" element={<NotFound />} />
        </Routes>
      </main>
      <CompareTray />
    </div>
  );
}

function ProtectedRoute({ children }) {
  const { user, authLoading } = useAuth();
  const location = useLocation();

  if (authLoading) {
    return <p className="notice detailNotice">Checking your session...</p>;
  }

  if (!user) {
    return <Navigate to="/login" replace state={{ from: location }} />;
  }

  return children;
}

function CollegeList() {
  const [colleges, setColleges] = useState([]);
  const [availableLocations, setAvailableLocations] = useState([]);
  const [search, setSearch] = useState('');
  const [location, setLocation] = useState('');
  const [minFees, setMinFees] = useState('');
  const [maxFees, setMaxFees] = useState('');
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState('');
  const { savedError } = useSavedColleges();

  useEffect(() => {
    const controller = new AbortController();
    const handle = setTimeout(() => {
      setLoading(true);
      api
        .getColleges({ name: search, location, minFees, maxFees }, { signal: controller.signal })
        .then((data) => {
          setColleges(data.colleges || []);
          setError('');
        })
        .catch((err) => {
          if (!err.isCanceled) setError(err.message);
        })
        .finally(() => {
          if (!controller.signal.aborted) setLoading(false);
        });
    }, 250);

    return () => {
      controller.abort();
      clearTimeout(handle);
    };
  }, [search, location, minFees, maxFees]);

  useEffect(() => {
    const controller = new AbortController();

    api
      .getColleges({}, { signal: controller.signal })
      .then((data) => {
        const locations = (data.colleges || []).flatMap((college) => [
          college.city,
          college.state
        ]);
        setAvailableLocations([...new Set(locations)].sort());
      })
      .catch(() => {});

    return () => controller.abort();
  }, []);

  const resetFilters = () => {
    setSearch('');
    setLocation('');
    setMinFees('');
    setMaxFees('');
  };

  return (
    <section className="page">
      <div className="sectionHeader">
        <div>
          <p className="eyebrow">Discovery</p>
          <h1>Find colleges that fit your ambition.</h1>
        </div>
        <div className="searchBox">
          <Search size={19} />
          <input
            value={search}
            onChange={(event) => setSearch(event.target.value)}
            placeholder="Search by college name"
          />
        </div>
      </div>

      <div className="filters">
        <label className="filterField">
          Location
          <select value={location} onChange={(event) => setLocation(event.target.value)}>
            <option value="">All locations</option>
            {availableLocations.map((item) => (
              <option key={item} value={item}>
                {item}
              </option>
            ))}
          </select>
        </label>
        <label className="filterField">
          Min fees
          <input
            type="number"
            min="0"
            step="1000"
            value={minFees}
            onChange={(event) => setMinFees(event.target.value)}
            placeholder="0"
          />
        </label>
        <label className="filterField">
          Max fees
          <input
            type="number"
            min="0"
            step="1000"
            value={maxFees}
            onChange={(event) => setMaxFees(event.target.value)}
            placeholder="250000"
          />
        </label>
        <button className="secondaryButton filterButton" onClick={resetFilters}>
          Reset
        </button>
      </div>

      <div className="activeFilters">
        {search && <span>Name: {search}</span>}
        {location && <span>Location: {location}</span>}
        {minFees && <span>Min: {currency(Number(minFees))}</span>}
        {maxFees && <span>Max: {currency(Number(maxFees))}</span>}
      </div>

      {error ? (
        <p className="notice error">{error}</p>
      ) : savedError ? (
        <p className="notice error">{savedError}</p>
      ) : loading ? (
        <p className="notice">Loading colleges...</p>
      ) : colleges.length === 0 ? (
        <p className="notice">No colleges found. Try a different search or filter.</p>
      ) : (
        <div className="collegeGrid">
          {colleges.map((college) => (
            <CollegeCard key={college.id} college={college} />
          ))}
        </div>
      )}
    </section>
  );
}

function CollegeCard({ college }) {
  const { user } = useAuth();
  const { ids, toggle } = useCompare();
  const { savedIds, toggleSaved } = useSavedColleges();
  const navigate = useNavigate();
  const routeLocation = useLocation();
  const isSelected = ids.includes(college.id);
  const isCompareDisabled = ids.length >= 3 && !isSelected;
  const isSaved = savedIds.includes(college.id);

  const handleSave = async () => {
    if (!user) {
      navigate('/login', { state: { from: routeLocation } });
      return;
    }

    await toggleSaved(college.id).catch(() => {});
  };

  return (
    <article className="collegeCard">
      <img src={college.image_url} alt="" />
      <div className="cardBody">
        <div className="cardMeta">
          <span>{college.type}</span>
          <strong>{Number(college.rating).toFixed(1)}</strong>
        </div>
        <div className="cardTitleRow">
          <h2>{college.name}</h2>
          <button
            className={`iconButton saveButton ${isSaved ? 'active' : ''}`}
            title={isSaved ? 'Remove from saved colleges' : 'Save college'}
            onClick={handleSave}
          >
            <Heart size={18} fill={isSaved ? 'currentColor' : 'none'} />
          </button>
        </div>
        <p>{college.city}, {college.state}</p>
        <div className="courseRow">
          {college.courses.slice(0, 3).map((course) => (
            <span key={course}>{course}</span>
          ))}
        </div>
        <dl className="stats">
          <div>
            <dt>Annual fees</dt>
            <dd>{currency(college.annual_fees)}</dd>
          </div>
          <div>
            <dt>Avg package</dt>
            <dd>{currency(college.average_package)}</dd>
          </div>
        </dl>
        <div className="actions">
          <Link className="primaryButton" to={`/colleges/${college.id}`}>
            View details
          </Link>
          <button
            className="secondaryButton"
            disabled={isCompareDisabled}
            title={isCompareDisabled ? 'Remove a college before adding another.' : undefined}
            onClick={() => toggle(college.id)}
          >
            {isSelected ? 'Remove' : isCompareDisabled ? 'Limit reached' : 'Compare'}
          </button>
        </div>
      </div>
    </article>
  );
}

function CollegeDetail() {
  const [college, setCollege] = useState(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState('');
  const { id } = useParams();
  const { user } = useAuth();
  const { ids, toggle } = useCompare();
  const { savedIds, toggleSaved } = useSavedColleges();
  const navigate = useNavigate();
  const routeLocation = useLocation();
  const collegeId = Number(id);
  const isValidId = Number.isInteger(collegeId) && collegeId > 0;
  const isCompareDisabled = college ? ids.length >= 3 && !ids.includes(college.id) : false;
  const isSaved = college ? savedIds.includes(college.id) : false;

  useEffect(() => {
    const controller = new AbortController();

    if (!isValidId) {
      setCollege(null);
      setError('Invalid college ID. Please choose a college from the listing page.');
      setLoading(false);
      return () => controller.abort();
    }

    setLoading(true);
    setError('');
    setCollege(null);

    api
      .getCollege(collegeId, { signal: controller.signal })
      .then((data) => {
        setCollege(data.college);
        setError('');
      })
      .catch((err) => {
        if (!err.isCanceled) setError(err.message);
      })
      .finally(() => {
        if (!controller.signal.aborted) setLoading(false);
      });

    return () => controller.abort();
  }, [collegeId, isValidId]);

  if (error) {
    return (
      <DetailStatus title="College unavailable" message={error} />
    );
  }

  if (loading || !college) {
    return <p className="notice detailNotice">Loading college details...</p>;
  }

  const handleSave = async () => {
    if (!user) {
      navigate('/login', { state: { from: routeLocation } });
      return;
    }

    await toggleSaved(college.id).catch(() => {});
  };

  return (
    <section className="detailPage">
      <div className="detailHero" style={{ backgroundImage: `url(${college.image_url})` }}>
        <div>
          <p>{college.type} - Est. {college.established_year}</p>
          <h1>{college.name}</h1>
          <span>{college.city}, {college.state}</span>
        </div>
      </div>

      <div className="detailContent">
        <section>
          <h2>Overview</h2>
          <p>{college.description}</p>
          <div className="detailActions">
            <button
              className="primaryButton"
              disabled={isCompareDisabled}
              title={isCompareDisabled ? 'Remove a college before adding another.' : undefined}
              onClick={() => toggle(college.id)}
            >
              {ids.includes(college.id)
                ? 'Remove from compare'
                : isCompareDisabled
                  ? 'Compare limit reached'
                  : 'Add to compare'}
            </button>
            <button className="secondaryButton" onClick={handleSave}>
              <Heart size={17} fill={isSaved ? 'currentColor' : 'none'} />
              {isSaved ? 'Saved' : 'Save college'}
            </button>
          </div>
        </section>

        <aside className="detailPanel">
          <Metric label="Name" value={college.name} />
          <Metric label="Location" value={`${college.city}, ${college.state}`} />
          <Metric label="Rating" value={`${Number(college.rating).toFixed(1)} / 5`} />
          <Metric label="Fees" value={currency(college.annual_fees)} />
          <Metric label="Placement" value={currency(college.average_package)} />
        </aside>

        <section className="detailSummary">
          <Metric label="Name" value={college.name} />
          <Metric label="Location" value={`${college.city}, ${college.state}`} />
          <Metric label="Fees" value={currency(college.annual_fees)} />
          <Metric label="Rating" value={`${Number(college.rating).toFixed(1)} / 5`} />
          <Metric label="Placement" value={`${currency(college.average_package)} avg`} />
        </section>

        <section>
          <h2>Courses</h2>
          <div className="pillList">
            {college.courses.map((course) => (
              <span key={course}>{course}</span>
            ))}
          </div>
        </section>

        <section>
          <h2>Facilities</h2>
          <div className="pillList">
            {college.facilities.map((facility) => (
              <span key={facility}>{facility}</span>
            ))}
          </div>
        </section>
      </div>
    </section>
  );
}

function DetailStatus({ title, message }) {
  return (
    <section className="page emptyState">
      <h1>{title}</h1>
      <p>{message}</p>
      <Link className="primaryButton" to="/">Browse colleges</Link>
    </section>
  );
}

function NotFound() {
  return (
    <section className="page emptyState">
      <h1>Page not found</h1>
      <p>The page you are looking for does not exist.</p>
      <Link className="primaryButton" to="/">Browse colleges</Link>
    </section>
  );
}

function Metric({ label, value }) {
  return (
    <div className="metric">
      <span>{label}</span>
      <strong>{value}</strong>
    </div>
  );
}

function CompareTray() {
  const { ids, clear } = useCompare();

  if (ids.length === 0) return null;

  return (
    <div className="compareTray">
      <span>
        {ids.length} selected
        {ids.length < 2 ? ' - select at least 2' : ''}
      </span>
      {ids.length >= 2 ? (
        <Link to="/compare" className="primaryButton">Compare</Link>
      ) : (
        <button className="primaryButton" disabled>Compare</button>
      )}
      <button className="secondaryButton" onClick={clear}>Clear</button>
    </div>
  );
}

function SavedCollegesPage() {
  const { savedIds } = useSavedColleges();
  const [colleges, setColleges] = useState([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState('');

  useEffect(() => {
    const controller = new AbortController();

    setLoading(true);
    api
      .getSavedColleges({ signal: controller.signal })
      .then((data) => {
        setColleges(data.colleges || []);
        setError('');
      })
      .catch((err) => {
        if (!err.isCanceled) setError(err.message);
      })
      .finally(() => {
        if (!controller.signal.aborted) setLoading(false);
      });

    return () => controller.abort();
  }, []);

  const visibleColleges = colleges.filter((college) => savedIds.includes(college.id));

  return (
    <section className="page">
      <div className="sectionHeader">
        <div>
          <p className="eyebrow">Saved</p>
          <h1>Your saved colleges.</h1>
        </div>
        <Link className="secondaryButton" to="/">Browse more</Link>
      </div>

      {error ? (
        <p className="notice error">{error}</p>
      ) : loading ? (
        <p className="notice">Loading saved colleges...</p>
      ) : visibleColleges.length === 0 ? (
        <section className="emptyState compactEmpty">
          <h1>No saved colleges yet</h1>
          <p>Save colleges from the listing or detail page and they will appear here.</p>
          <Link className="primaryButton" to="/">Browse colleges</Link>
        </section>
      ) : (
        <div className="collegeGrid">
          {visibleColleges.map((college) => (
            <CollegeCard key={college.id} college={college} />
          ))}
        </div>
      )}
    </section>
  );
}

function ComparePage() {
  const { ids, toggle, clear } = useCompare();
  const [colleges, setColleges] = useState([]);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState('');

  useEffect(() => {
    if (ids.length < 2) {
      setColleges([]);
      return;
    }

    const controller = new AbortController();

    setLoading(true);
    api
      .compareColleges(ids, { signal: controller.signal })
      .then((data) => {
        setColleges(data.colleges || []);
        setError('');
      })
      .catch((err) => {
        if (!err.isCanceled) setError(err.message);
      })
      .finally(() => {
        if (!controller.signal.aborted) setLoading(false);
      });

    return () => controller.abort();
  }, [ids]);

  if (ids.length < 2) {
    return (
      <section className="page emptyState">
        <h1>Select 2 or 3 colleges</h1>
        <p>Add one more college from the listing page to compare fees, rating, placement, and location.</p>
        <Link className="primaryButton" to="/">Browse colleges</Link>
      </section>
    );
  }

  return (
    <section className="page">
      <div className="sectionHeader">
        <div>
          <p className="eyebrow">Compare</p>
          <h1>Compare shortlisted colleges.</h1>
        </div>
        <button className="secondaryButton" onClick={clear}>Clear all</button>
      </div>
      {error && <p className="notice error">{error}</p>}
      {loading && <p className="notice">Loading comparison...</p>}
      {!loading && !error && colleges.length >= 2 && (
        <div className="compareTableWrap">
          <table className="compareTable">
            <thead>
              <tr>
                <th>College</th>
                {colleges.map((college) => (
                  <th key={college.id}>
                    <span>{college.name}</span>
                    <button className="linkButton removeCompare" onClick={() => toggle(college.id)}>
                      Remove
                    </button>
                  </th>
                ))}
              </tr>
            </thead>
            <tbody>
              <tr>
                <th>Name</th>
                {colleges.map((college) => <td key={college.id}>{college.name}</td>)}
              </tr>
              <tr>
                <th>Fees</th>
                {colleges.map((college) => <td key={college.id}>{currency(college.annual_fees)}</td>)}
              </tr>
              <tr>
                <th>Rating</th>
                {colleges.map((college) => (
                  <td key={college.id}>{Number(college.rating).toFixed(1)} / 5</td>
                ))}
              </tr>
              <tr>
                <th>Placement</th>
                {colleges.map((college) => <td key={college.id}>{currency(college.average_package)}</td>)}
              </tr>
              <tr>
                <th>Location</th>
                {colleges.map((college) => <td key={college.id}>{college.city}, {college.state}</td>)}
              </tr>
            </tbody>
          </table>
        </div>
      )}
    </section>
  );
}

function LoginPage() {
  return <AuthPage mode="login" />;
}

function SignupPage() {
  return <AuthPage mode="signup" />;
}

function AuthPage({ mode }) {
  const { user, authLoading, login } = useAuth();
  const location = useLocation();
  const navigate = useNavigate();
  const isSignup = mode === 'signup';
  const [form, setForm] = useState({ name: '', email: '', password: '' });
  const [error, setError] = useState('');
  const [submitting, setSubmitting] = useState(false);
  const redirectTo = location.state?.from?.pathname || '/';

  if (!authLoading && user) {
    return <Navigate to={redirectTo} replace />;
  }

  const submit = async (event) => {
    event.preventDefault();
    setSubmitting(true);
    setError('');

    try {
      const data = isSignup ? await api.register(form) : await api.login(form);
      login(data);
      navigate(redirectTo, { replace: true });
    } catch (err) {
      setError(err.message);
    } finally {
      setSubmitting(false);
    }
  };

  return (
    <section className="authPage">
      <form className="authForm" onSubmit={submit}>
        <p className="eyebrow">Account</p>
        <h1>{isSignup ? 'Create your account' : 'Welcome back'}</h1>
        {isSignup && (
          <label>
            Name
            <input
              value={form.name}
              onChange={(event) => setForm({ ...form, name: event.target.value })}
              required
            />
          </label>
        )}
        <label>
          Email
          <input
            type="email"
            value={form.email}
            onChange={(event) => setForm({ ...form, email: event.target.value })}
            required
          />
        </label>
        <label>
          Password
          <input
            type="password"
            value={form.password}
            onChange={(event) => setForm({ ...form, password: event.target.value })}
            required
            minLength={6}
          />
        </label>
        {error && <p className="notice error">{error}</p>}
        <button className="primaryButton" disabled={submitting}>
          {submitting ? 'Please wait...' : isSignup ? 'Sign up' : 'Login'}
        </button>
        <Link className="linkButton authSwitch" to={isSignup ? '/login' : '/signup'} state={location.state}>
          {isSignup ? 'Already have an account?' : 'Need an account?'}
        </Link>
      </form>
    </section>
  );
}

export default function App() {
  return (
    <AuthProvider>
      <SavedProvider>
        <CompareProvider>
          <Layout />
        </CompareProvider>
      </SavedProvider>
    </AuthProvider>
  );
}
