import { registerSW } from "virtual:pwa-register";
import "./style.css";
import "./app";

registerSW({ immediate: true });
