import "./styles.css";
import { loadGarage } from "./lib/garage";
import { applyTheme } from "./hud/dom";

const garage = loadGarage();
applyTheme(garage);
const chip = document.querySelector("#rank-chip");
if (chip) chip.textContent = garage.tag;
document.body.classList.add("hud-ready");

void import("./app").then(({ boot }) => boot()).catch((err) => {
  const banner = document.getElementById("net-banner");
  if (banner) {
    banner.hidden = false;
    banner.textContent = "Can't start Slide. Check the connection and reload.";
  }
  console.error(err);
});
