const SAFE_RICH_HTML_TAGS=new Set(['p','br','strong','b','em','i','u','s','ul','ol','li','a','h3','h4','blockquote']);

export function sanitizeRichHtml(value){
  const parser=new DOMParser();
  const doc=parser.parseFromString(`<div>${String(value??'')}</div>`,'text/html');
  const source=doc.body.firstElementChild;
  const output=document.createElement('div');

  const copy=(node,parent)=>{
    if(node.nodeType===Node.TEXT_NODE){
      parent.appendChild(document.createTextNode(node.nodeValue||''));
      return;
    }
    if(node.nodeType!==Node.ELEMENT_NODE) return;

    const tag=node.tagName.toLowerCase();
    if(!SAFE_RICH_HTML_TAGS.has(tag)){
      for(const child of [...node.childNodes]) copy(child,parent);
      return;
    }

    const el=document.createElement(tag);
    if(tag==='a'){
      const rawHref=String(node.getAttribute('href')||'').trim();
      if(rawHref){
        try{
          const parsed=new URL(rawHref,location.origin);
          if(['http:','https:','mailto:','tel:'].includes(parsed.protocol)){
            el.setAttribute('href',parsed.href);
            if(parsed.protocol==='http:' || parsed.protocol==='https:'){
              el.setAttribute('target','_blank');
              el.setAttribute('rel','noopener noreferrer');
            }
          }
        }catch{}
      }
    }
    for(const child of [...node.childNodes]) copy(child,el);
    parent.appendChild(el);
  };

  if(source) for(const child of [...source.childNodes]) copy(child,output);
  return output.innerHTML;
}
