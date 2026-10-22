import React, { Component } from "react";
import Dropzone from "react-dropzone";
import ZoomWrapper from "./ZoomWrapper";

class ImageUploader extends Component {
  constructor(props) {
    super(props);
    this.state = { files: [] };
    this.onDrop = this.onDrop.bind(this);
    this.state = { files: [], sliderPos: 50 };
  }

  componentDidUpdate(prevProps) {
    if (prevProps.editTrigger !== this.props.editTrigger) {
      this.reprocessImages();
    }
  }

  componentWillUnmount() {
    this.state.files.forEach((f) => URL.revokeObjectURL(f.preview));
  }

  async uploadToServer(file) {
    const { filterSettings } = this.props;
    const start = Date.now();

    let processedFile = file;

    if (file.name.endsWith(".msi")) {
      const decoded = await this.decodeMsi(file);

      
      const res = await fetch(decoded.src);
      const blob = await res.blob();

      processedFile = new File([blob], "decoded.png", {
        type: "image/png",
      });
    }
    const logEntry = {
      timestamp: new Date().toISOString(),
      user: "local",
      file: file.name,
      filter:
        filterSettings?.batchFilters?.length > 0
          ? filterSettings.batchFilters
          : filterSettings?.filterName,
      settings: filterSettings,
    };

    console.log("[REQUEST]", logEntry);

    const formData = new FormData();
    formData.append("image", processedFile);

    if (filterSettings?.batchFilters?.length > 0) {
      const filters = filterSettings.batchFilters.map((filterName) => ({
        filterName,
        brightness: filterSettings.brightness,
        sharpen: filterSettings.sharpen,
        flip: filterSettings.flip,
        jitter: filterSettings.jitter,
        dotSize: filterSettings.dotSize,
        threshold: filterSettings.edgeThreshold,
      }));
      formData.append("filters", JSON.stringify(filters));
      formData.append("mode", "batch");
    } else {
      formData.append("filterName", filterSettings.filterName);
      formData.append("brightness", filterSettings.brightness);
      formData.append("sharpen", filterSettings.sharpen);
      formData.append("flip", filterSettings.flip);
      formData.append("pixelScale", filterSettings.pixelScale);
      formData.append("jitter", filterSettings.jitter);
      formData.append("dotSize", filterSettings.dotSize);
      formData.append("threshold", filterSettings.edgeThreshold);
      formData.append("h", filterSettings.h);
      formData.append("w", filterSettings.w);
      formData.append("mode", "single");
    }

    try {
      console.log("mode:", formData.get("mode"));
      console.log("filterName:", formData.get("filterName"));
      console.log("filters:", formData.get("filters"));
      const response = await fetch("http://localhost:8000/process-image", {
        method: "POST",
        body: formData,
      });
      const data = await response.json();

      console.log("[RESPONSE]", {
        ...logEntry,
        duration_ms: Date.now() - start,
        success: true,
      });

      return `data:${data.type};base64,${data.image}`;
    } catch (err) {
      console.error("[ERROR]", {
        ...logEntry,
        duration_ms: Date.now() - start,
        success: false,
        error: err.message,
      });
      return null;
    }
  }

  async reprocessImages() {
    const currentFiles = this.state.files;
    if (currentFiles.length === 0) return;

    const updatedFiles = await Promise.all(
      currentFiles.map(async ({ file, preview, name }) => {
        const serverPreview = await this.uploadToServer(file);
        if (this.props.onImageReady) this.props.onImageReady(serverPreview);
        return { file, preview, serverPreview, name };
      }),
    );
    this.setState({ files: updatedFiles });
  }

  onDrop(acceptedFiles) {
    const filesWithPreview = acceptedFiles.map((file) => ({
      file,
      preview: URL.createObjectURL(file),
      serverPreview: null,
      name: file.name,
      isMsi: file.name.endsWith(".msi"),
    }));

    this.setState({ files: filesWithPreview }, () => {
      filesWithPreview.forEach((f) => {
        if (f.isMsi) this.decodeMsi(f.file);
      });
    });
    if (acceptedFiles.length > 0 && this.props.runBenchmark) {
      this.props.runBenchmark(acceptedFiles[0]);
    }
  }

  async decodeMsi(file) {
    const formData = new FormData();
    formData.append("image", file);

    try {
      const response = await fetch("http://localhost:8000/decode-msi", {
        method: "POST",
        body: formData,
      });
      const data = await response.json();
      const src = `data:${data.type};base64,${data.image}`;

      // update the file entry with decoded preview
      this.setState((prev) => ({
        files: prev.files.map((f) =>
          f.name === file.name
            ? { ...f, preview: src, serverPreview: null }
            : f,
        ),
      }));
      return {
        src: `data:${data.type};base64,${data.image}`,
      };
    } catch (err) {
      console.error("MSI decode failed:", err);
    }
  }

  handleSaveAs(dataUrl, fileName) {
    const link = document.createElement("a");
    link.href = dataUrl;
    link.download = fileName;
    link.click();
  }

  render() {
    const { imageWidth = 1000, imageHeight = 1000 } = this.props;

    const images = this.state.files.map(
      ({ name, preview, serverPreview, file }) => (
        <div key={name} style={{ margin: "10px" }}>
          {this.props.compareMode && serverPreview ? (
            <div
              style={{
                position: "relative",
                display: "inline-block",
                cursor: "ew-resize",
                border: "1px solid #ccc",
              }}
              onMouseMove={(e) => {
                const rect = e.currentTarget.getBoundingClientRect();
                const pos = ((e.clientX - rect.left) / rect.width) * 100;
                this.setState({ sliderPos: Math.min(100, Math.max(0, pos)) });
              }}
            >
              <img
                src={serverPreview}
                alt="processed"
                style={{ display: "block" }}
              />

              <img
                src={preview}
                alt="original"
                style={{
                  position: "absolute",
                  top: 0,
                  left: 0,
                  clipPath: `inset(0 ${100 - this.state.sliderPos}% 0 0)`,
                  display: "block",
                }}
              />

              <div
                style={{
                  position: "absolute",
                  top: 0,
                  left: `${this.state.sliderPos}%`,
                  width: "2px",
                  height: "100%",
                  background: "var(--accent)",
                  pointerEvents: "none",
                }}
              />

              <span
                style={{
                  position: "absolute",
                  top: 8,
                  lft: 8,
                  fontSize: 10,
                  color: "#fff",
                  background: "rgba(0,0,0,0.5)",
                  padding: "2px 6px",
                  borderRadius: 4,
                }}
              >
                ORIGINAL
              </span>
              <span
                style={{
                  position: "absolute",
                  top: 8,
                  right: 8,
                  fontSize: 10,
                  color: "#fff",
                  background: "rgba(0,0,0,0.5)",
                  padding: "2px 6px",
                  borderRadius: 4,
                }}
              >
                EDITED
              </span>
            </div>
          ) : (
            <ZoomWrapper>
              <img
                src={serverPreview || preview}
                alt={name}
                style={{
                  objectFit: "contain",
                  display: "block",
                  border: "1px solid #ccc",
                }}
              />
            </ZoomWrapper>
          )}
        </div>
      ),
    );

    return (
      <Dropzone
        onDrop={this.onDrop}
        accept={{ "image/*": [], "appliaction/octet-stream": [".msi"] }}
      >
        {({ getRootProps, getInputProps }) => (
          <section className="container">
            <div {...getRootProps({ className: "dropzone" })}>
              <input className="inputDragNDrop" {...getInputProps()} />
              <p className="text">
                Drag 'n' drop some images here, or click to select images
              </p>
            </div>
            <aside>
              <h4 className="text">Preview</h4>
              {images}
            </aside>
          </section>
        )}
      </Dropzone>
    );
  }
}

export default ImageUploader;
