import React, { useState, useEffect, useRef } from "react";
import "./App.css";
import Filters from "./filters.js";
import ImageUploader from "./ImageUploader.js";
import ZoomWrapper from "./ZoomWrapper.js";

function App() {
  const [imageWidth, setImageWidth] = useState(200);
  const [imageHeight, setImageHeight] = useState(300);
  const [editTrigger, setEditTrigger] = useState(0);
  const [filterSettings, setFilterSettings] = useState({
    filterName: "Brightness",
    brightness: 0,
    sharpen: 5,
    flip: "horizontal",
    pixelScale: 1,
    jitter: 0,
    dotSize: 5,
    w: 0,
    h: 0,
  });
  const [compareMode, setCompareMode] = useState(false);
  const [currentImageSrc, setCurrentImageSrc] = useState(null);
  const [saveFormat, setSaveFormat] = useState("png");
  const [history, setHistory] = useState([]);
  const [historyIndex, setHistoryIndex] = useState(-1);
  const [benchmarkData, setBenchmarkData] = useState([]);

  const handleEdit = (batchFilters = null) => {
    const newSettings =
      batchFilters?.length > 0
        ? { ...filterSettings, batchFilters }
        : { ...filterSettings, batchFilters: null };

    setFilterSettings(newSettings);
    const newHistory = [
      ...history.slice(0, historyIndex + 1),
      newSettings,
    ].slice(-3);
    setHistory(newHistory);
    setHistoryIndex(newHistory.length - 1);
    setEditTrigger((n) => n + 1);
  };

  const applySettings = (newSettings) => {
    const newHistory = [
      ...history.slice(0, historyIndex + 1),
      newSettings,
    ].slice(-3);
    setHistory(newHistory);
    setHistoryIndex(newHistory.length - 1);
    setFilterSettings(newSettings);
  };

  const undo = () => {
    if (historyIndex <= 0) return;
    const newIndex = historyIndex - 1;
    setHistoryIndex(newIndex);
    setFilterSettings(history[newIndex]);
    setEditTrigger((n) => n + 1);
  };

  const redo = () => {
    if (historyIndex >= history.length - 1) return;
    const newIndex = historyIndex + 1;
    setHistoryIndex(newIndex);
    setFilterSettings(history[newIndex]);
    setEditTrigger((n) => n + 1);
  };

  const handleSaveAs = async () => {
    if (!currentImageSrc) return;

    if (saveFormat === "msi") {
      const res = await fetch(currentImageSrc);
      const blob = await res.blob();
      const formData = new FormData();
      formData.append("image", blob, "image.png");
      const response = await fetch("http://localhost:8000/encode-msi", {
        method: "POST",
        body: formData,
      });
      const msiBlob = await response.blob();
      const link = document.createElement("a");
      link.href = URL.createObjectURL(msiBlob);
      link.download = "image.msi";
      link.click();
      return;
    }

    const img = new Image();
    img.onload = () => {
      const canvas = document.createElement("canvas");
      canvas.width = img.naturalWidth;
      canvas.height = img.naturalHeight;
      canvas.getContext("2d").drawImage(img, 0, 0);
      const dataUrl = canvas.toDataURL(`image/${saveFormat}`);
      const link = document.createElement("a");
      link.href = dataUrl;
      link.download = `image.${saveFormat}`;
      link.click();
    };
    img.src = currentImageSrc;
  };

  const runBenchmark = async (file) => {
    const formData = new FormData();
    formData.append("image", file);
    try {
      const res = await fetch("http://localhost:8000/benchmark-filters", {
        method: "POST",
        body: formData,
      });
      const data = await res.json();
      const chartData = Object.entries(data).map(([filter, stats]) => ({
        filter,
        latency: stats.avg,
      }));
      setBenchmarkData(chartData);
    } catch (err) {
      console.error("Benchmark failed:", err);
    }
  };

  return (
    <div className="appDiv">
      <div className="headerDiv">
        <div className="headerDiv">
          <h1 className="h1">Filtering!</h1>
          <button
            className="selectFilter"
            onClick={undo}
            disabled={historyIndex <= 0}
            style={{ opacity: historyIndex <= 0 ? 0.4 : 1 }}
          >
            Undo
          </button>
          <button
            className="selectFilter"
            onClick={redo}
            disabled={historyIndex >= history.length - 1}
            style={{ opacity: historyIndex >= history.length - 1 ? 0.4 : 1 }}
          >
            Redo
          </button>
          <span style={{ color: "var(--muted)", fontSize: 11 }}>
            {historyIndex + 1} / {Math.min(history.length, 3)}
          </span>
        </div>
      </div>

      <div className="bodyDiv">
        <div className="filterDiv">
          <Filters
            imageWidth={imageWidth}
            setImageWidth={setImageWidth}
            imageHeight={imageHeight}
            setImageHeight={setImageHeight}
            filterSettings={filterSettings}
            setFilterSettings={setFilterSettings}
            onEdit={handleEdit}
          />
        </div>

        <div className="imageUploaderDiv">
          <ImageUploader
            imageWidth={imageWidth}
            imageHeight={imageHeight}
            editTrigger={editTrigger}
            filterSettings={filterSettings}
            onImageReady={setCurrentImageSrc}
            compareMode={compareMode}
            runBenchmark={runBenchmark}
          />
        </div>

        <div className="dataDiv">
          <div className="file-type-list">
            <button
              className="selectFilter"
              onClick={() => setCompareMode((c) => !c)}
            >
              {compareMode ? "Exit Compare" : "Compare"}
            </button>
            <h2>Download as:</h2>
            {["png", "jpeg", "bmp", "gif", "msi"].map((type) => (
              <span
                key={type}
                className={`file-type-item ${saveFormat === type ? "active" : ""}`}
                onClick={() => setSaveFormat(type)}
              >
                {type.toUpperCase()}
              </span>
            ))}
          </div>
          <button className="selectFilter" onClick={handleSaveAs}>
            Save As
          </button>

          
        </div>
      </div>
    </div>
  );
}

export default App;
