/** The game's own palette and faces (css/style.css), so captions read as part of it. */
import { loadFont as loadBody } from '@remotion/google-fonts/AtkinsonHyperlegible';
import { loadFont as loadDisplay } from '@remotion/google-fonts/ChakraPetch';

const display = loadDisplay('normal', { weights: ['500', '700'], subsets: ['latin'] });
const body = loadBody('normal', { weights: ['400', '700'], subsets: ['latin'] });

export const theme = {
  space: '#141a33',
  deep: '#0c1024',
  panel: '#1e2648',
  line: '#34407a',
  ink: '#eef0fb',
  muted: '#a9b1d6',
  amber: '#ffb84d',
  teal: '#4fd6c4',
  coral: '#ff7a6b',
  display: `${display.fontFamily}, sans-serif`,
  body: `${body.fontFamily}, sans-serif`,
};
