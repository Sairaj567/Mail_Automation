// server/middleware/role.js
function ensureLoggedIn(req, res, next) {
  if(req.session && req.session.user) return next();
  return res.redirect('/login');
}
function ensureRole(role) {
  return function(req, res, next) {
    if(req.session?.user?.role === role) return next();
    return res.status(403).send('Access denied');
  }
}
module.exports = { ensureLoggedIn, ensureRole };
