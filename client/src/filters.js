import { useState } from "react";
import Tabs from "@mui/material/Tabs";
import Tab from "@mui/material/Tab";
import "./Filters.css";

export default function Filters({
  imageWidth,
  setImageWidth,
  imageHeight,
  setImageHeight,
  filterSettings,
  setFilterSettings,
  onEdit,
}) {
  const [tab, setTab] = useState(0);
  const [batchFilters, setBatchFilters] = useState([]);


  const update = (key, value) =>
    setFilterSettings((prev) => ({ ...prev, [key]: value }));


  const toggleBatchFilter = (filterName) => {
    setBatchFilters((prev) =>
      prev.includes(filterName)
        ? prev.filter((f) => f !== filterName)
        : [...prev, filterName],
    );
  };

  const allFilters = [
    "Brightness",
    "Invert",
    "Sharpen",
    "EdgeEnhance",
    "FlipHorVer",
    "RandomJitter",
    "BillAtkinson",
    "Halftone",
  ];

  return (
    <div>
      <Tabs
        value={tab}
        onChange={(e, newVal) => setTab(newVal)}
        textColor="inherit"
        TabIndicatorProps={{ style: { background: "var(--accent)" } }}
        sx={{ borderBottom: "1px solid var(--border)", minHeight: 36 }}
      >
        <Tab
          label="Single"
          sx={{ color: "var(--muted)", minHeight: 36, fontSize: 11 }}
        />
        <Tab
          label="Batch"
          sx={{ color: "var(--muted)", minHeight: 36, fontSize: 11 }}
        />
      </Tabs>

      
      {tab === 0 && (
        <div className="options-panel">
          <select
            className="selectFilter"
            value={filterSettings.filterName}
            onChange={(e) => update("filterName", e.target.value)}
          >
            {allFilters.map((f) => (
              <option key={f} value={f}>
                {f}
              </option>
            ))}
          </select>

          {filterSettings.filterName === "Brightness" && (
            <>
              <label className="text">Brightness Amount</label>
              <input
                type="range"
                min="-100"
                max="100"
                value={filterSettings.brightness}
                onChange={(e) => update("brightness", Number(e.target.value))}
              />
            </>
          )}

          {filterSettings.filterName === "Invert" && (
            <p className="text">No additional settings required.</p>
          )}

          {filterSettings.filterName === "Sharpen" && (
            <>
              <label className="text">Strength</label>
              <input
                type="range"
                min="1"
                max="10"
                value={filterSettings.sharpen}
                onChange={(e) => update("sharpen", Number(e.target.value))}
              />
            </>
          )}

          {filterSettings.filterName === "EdgeEnhance" && (
            <>
              <label className="text">Threshold</label>
              <input
                type="range"
                min="0"
                max="100"
                value={filterSettings.edgeThreshold ?? 50}
                onChange={(e) =>
                  update("edgeThreshold", Number(e.target.value))
                }
              />
            </>
          )}

          {filterSettings.filterName === "FlipHorVer" && (
            <>
              <label className="text">
                <input
                  type="radio"
                  name="flip"
                  value="horizontal"
                  checked={filterSettings.flip === "horizontal"}
                  onChange={(e) => update("flip", e.target.value)}
                />{" "}
                Horizontal
              </label>
              <label className="text">
                <input
                  type="radio"
                  name="flip"
                  value="vertical"
                  checked={filterSettings.flip === "vertical"}
                  onChange={(e) => update("flip", e.target.value)}
                />{" "}
                Vertical
              </label>
            </>
          )}

          {filterSettings.filterName === "RandomJitter" && (
            <>
              <label className="text">Jitter Amount</label>
              <input
                type="range"
                min="0"
                max="100"
                value={filterSettings.jitter}
                onChange={(e) => update("jitter", Number(e.target.value))}
              />
            </>
          )}

          {filterSettings.filterName === "BillAtkinson" && (
            <p className="text">No configurable options.</p>
          )}

          {filterSettings.filterName === "Halftone" && (
            <>
              <label className="text">Dot Size</label>
              <input
                type="range"
                min="2"
                max="30"
                value={filterSettings.dotSize}
                onChange={(e) => update("dotSize", Number(e.target.value))}
              />
            </>
          )}
          <button
            className="selectFilter batch-apply-btn"
            onClick={() => onEdit(null)}
          >
            Edit!
          </button>
        </div>
      )}

      {tab === 1 && (
        <div className="options-panel">
          <h3 className="text">Select filters to apply in order:</h3>
          <div className="batch-filter-list">
            {allFilters.map((filterName) => (
              <div key={filterName}>
                <label className="text batch-filter-item">
                  <input
                    type="checkbox"
                    checked={batchFilters.includes(filterName)}
                    onChange={() => toggleBatchFilter(filterName)}
                  />
                  {filterName}
                </label>

                
                {batchFilters.includes(filterName) &&
                  filterName === "Brightness" && (
                    <div className="batch-filter-options">
                      <label className="text">Brightness Amount</label>
                      <input
                        type="range"
                        min="-100"
                        max="100"
                        value={filterSettings.brightness}
                        onChange={(e) =>
                          update("brightness", Number(e.target.value))
                        }
                      />
                    </div>
                  )}

                {batchFilters.includes(filterName) &&
                  filterName === "Sharpen" && (
                    <div className="batch-filter-options">
                      <label className="text">Strength</label>
                      <input
                        type="range"
                        min="1"
                        max="10"
                        value={filterSettings.sharpen}
                        onChange={(e) =>
                          update("sharpen", Number(e.target.value))
                        }
                      />
                    </div>
                  )}

                {batchFilters.includes(filterName) &&
                  filterName === "EdgeEnhance" && (
                    <div className="batch-filter-options">
                      <label className="text">Threshold</label>
                      <input
                        type="range"
                        min="0"
                        max="100"
                        value={filterSettings.edgeThreshold ?? 50}
                        onChange={(e) =>
                          update("edgeThreshold", Number(e.target.value))
                        }
                      />
                    </div>
                  )}

                {batchFilters.includes(filterName) &&
                  filterName === "FlipHorVer" && (
                    <div className="batch-filter-options">
                      <label className="text batch-filter-item">
                        <input
                          type="radio"
                          name="batch-flip"
                          value="horizontal"
                          checked={filterSettings.flip === "horizontal"}
                          onChange={(e) => update("flip", e.target.value)}
                        />{" "}
                        Horizontal
                      </label>
                      <label className="text batch-filter-item">
                        <input
                          type="radio"
                          name="batch-flip"
                          value="vertical"
                          checked={filterSettings.flip === "vertical"}
                          onChange={(e) => update("flip", e.target.value)}
                        />{" "}
                        Vertical
                      </label>
                    </div>
                  )}

                {batchFilters.includes(filterName) &&
                  filterName === "Halftone" && (
                    <div className="batch-filter-options">
                      <label className="text">Dot Size</label>
                      <input
                        type="range"
                        min="2"
                        max="30"
                        value={filterSettings.dotSize}
                        onChange={(e) =>
                          update("dotSize", Number(e.target.value))
                        }
                      />
                    </div>
                  )}

                {batchFilters.includes(filterName) &&
                  filterName === "RandomJitter" && (
                    <div className="batch-filter-options">
                      <label className="text">Jitter Amount</label>
                      <input
                        type="range"
                        min="0"
                        max="100"
                        value={filterSettings.jitter}
                        onChange={(e) =>
                          update("jitter", Number(e.target.value))
                        }
                      />
                    </div>
                  )}
              </div>
            ))}
          </div>

          {batchFilters.length > 0 && (
            <div className="batch-order">
              <p className="text">Order:</p>
              {batchFilters.map((f, i) => (
                <p key={f} className="text">
                  {i + 1}. {f}
                </p>
              ))}
            </div>
          )}

          <button
            className="selectFilter batch-apply-btn"
            onClick={() => onEdit(batchFilters)}
          >
            Apply Selection
          </button>
        </div>
      )}
    </div> 
  );
}
