import type { Board, BoardOptions } from "./contracts.js";
export declare const PROTECTED = "form,input,textarea,select,option,button,[contenteditable],script,style,noscript,pre,code,[aria-live],dialog,[role=\"dialog\"],[data-virus-ignore],[data-dom-virus-root],[data-dom-virus-effect],[data-swarm-ui]";
export declare function createBoard(doc: Document, options?: BoardOptions): Board;
