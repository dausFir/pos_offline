export function getHomePath(role) {
  return role === 'admin' || role === 'super_admin' ? '/dashboard' : '/pos';
}
