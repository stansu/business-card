import { writeFileSync } from 'node:fs';
import { CARD_TEMPLATE, templateFile } from '../src/templates.js';

const fixed = templateFile(CARD_TEMPLATE);
// 還原成修正前的樣子：font-size 也是佔位符
const old = CARD_TEMPLATE.replace(/font-size="([\d.]+)" data-size="\{\{(\w+)\}\}"/g, 'font-size="{{$2}}"');
writeFileSync(new URL('./new-template.svg', import.meta.url), fixed);
writeFileSync(new URL('./old-template.svg', import.meta.url), old);
console.log('new has font-size 3.6:', fixed.includes('font-size="3.6"'));
console.log('old has token font-size:', old.includes('font-size="{{name_zh_size}}"'));
