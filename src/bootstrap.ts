import '../family-layout.js';
if (!new URLSearchParams(location.search).has('legacy')) {
  void import('./GedcomxEditor');
} else {
  void import('./main');
}
