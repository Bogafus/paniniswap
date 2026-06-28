import StickerSwapOnlineApp from "./StickerSwapOnlineApp.jsx";
import StickerSwapApp from "./StickerSwap.jsx";
import { supabase } from "./supabaseClient.js";

export default function App() {
  if (!supabase) {
    return <StickerSwapApp />;
  }
  return <StickerSwapOnlineApp />;
}
