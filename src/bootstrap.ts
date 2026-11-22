import '../family-layout.js';
if (new URLSearchParams(location.search).has('editor')) {
  void import('./GedcomxEditor');
} else {
  void import('./main');
}
