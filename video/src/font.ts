import { loadFont } from "@remotion/google-fonts/Geist";

/** Willow ships Geist (Apple/YC register). Load the weights the film uses. */
export const { fontFamily } = loadFont("normal", {
  weights: ["300", "400", "500", "600", "700"],
  subsets: ["latin"],
});
