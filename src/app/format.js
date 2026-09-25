export function formatBytes(n=0){
  if(n<1024) return `${n} Б`;
  if(n<1024**2) return `${(n/1024).toFixed(1)} КБ`;
  return `${(n/1024**2).toFixed(1)} МБ`;
}
