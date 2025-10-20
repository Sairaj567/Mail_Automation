// server/middleware/role.js
function ensureLoggedIn(req, res, next) {
  if (req.session && req.session.user) return next();
  return res.redirect('/login');
}

function ensureRole(role) {
  return function (req, res, next) {
    if (req.session?.user?.role === role) return next();
    return res.status(403).send('Access denied');
  };
}

function requireAdmin(req, res, next) {
  if (req.session?.user?.role === 'admin') {
    return next();
  }
  if (req.originalUrl.startsWith('/admin')) {
    return res.redirect('/auth/login?role=admin');
  }
  return res.status(403).send('Admin access required');
}

module.exports = { ensureLoggedIn, ensureRole, requireAdmin };
