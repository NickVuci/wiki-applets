import { initAnalysisController } from "./controllers/analysis-controller.js";
import { initRangeController } from "./controllers/range-controller.js";
import { initScaleUploadController } from "./controllers/scale-upload-controller.js";
import { initTargetsController } from "./controllers/targets-controller.js";
import { initThemeController } from "./controllers/theme-controller.js";
import { initToneController } from "./controllers/tone-controller.js";
import { getDomElements } from "./dom/dom-elements.js";
import { getToneState } from "./tone-generator.js";
import { createAppState } from "./state/app-state.js";
import { renderRangeDependentUI } from "./views/bar-view.js";

const dom = getDomElements();
const state = createAppState(getToneState());
const actions = {};
const render = {
  rangeUi: () => renderRangeDependentUI(dom.meter, state)
};

initThemeController({ dom });
initRangeController({ dom, state, render });
const targetsController = initTargetsController({ dom, state, render });

render.syncRootControls = targetsController.syncRootControls;

initScaleUploadController({ dom, state, render });

const toneController = initToneController({ dom, state, actions });
actions.refreshToneUi = toneController.refreshToneUi;

const analysisController = initAnalysisController({ dom, state, actions });
actions.applyInternalToneState = analysisController.applyInternalToneState;

render.rangeUi();
