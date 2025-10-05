// Debug script to check tabindex values
setTimeout(() => {
  console.log('=== TABINDEX DEBUG ===');
  
  // Get all elements with tabindex
  const elements = Array.from(document.querySelectorAll('[tabindex]'));
  
  // Sort by tabindex value
  elements.sort((a, b) => {
    const aTab = parseInt(a.getAttribute('tabindex')) || 0;
    const bTab = parseInt(b.getAttribute('tabindex')) || 0;
    return aTab - bTab;
  });
  
  console.log('Elements in tab order:');
  elements.forEach((el, i) => {
    const tabindex = el.getAttribute('tabindex');
    const id = el.id || el.className || el.tagName;
    const text = el.textContent?.slice(0, 30) || '';
    console.log(`${i+1}. tabindex=${tabindex} - ${id} "${text}"`);
  });
  
  console.log('\nCriteria elements:');
  document.querySelectorAll('.axis-hit').forEach((el, i) => {
    console.log(`Criterion ${i}: tabindex=${el.getAttribute('tabindex')}`);
  });
  
  console.log('\nVertex elements:');
  document.querySelectorAll('.vertex').forEach((el, i) => {
    console.log(`Vertex ${i}: tabindex=${el.getAttribute('tabindex')}`);
  });
}, 2000);
