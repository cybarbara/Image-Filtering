# Image-Filtering
# MMS – Image Processing Application

A web-based image processing application built with **React.js** and **Node.js**. The application allows users to upload images, apply image filters, compare edited images with their originals, and download or save the processed results.

## Screenshots

### Main Interface
![Main Interface](Screenshots/Screenshot%202026-10-22%20184946.png)

## Features

- **Image Upload** – Upload images using drag and drop.
- **Supported Formats** – JPEG, PNG, BMP, and MSI.
- **Image Filters** – Apply image processing filters with configurable parameters.
- **Single and Batch Modes** – Choose between single-image editing and batch processing.
- **Image Comparison** – Compare the original image with the filtered version.
- **Undo and Redo** – Navigate through the last three saved editing states.
- **Zoom** – Enlarge images for closer inspection.
- **Download as** – Select the desired output image format.
- **Save As** – Save the processed image.
- **MSI Decoding** – Decode MSI files for processing.
- **Server Logging** – Record client requests and server processing times.

## Technologies Used

### Frontend
- React.js
- JavaScript
- CSS
- Dropzone for drag-and-drop uploads

### Backend
- Node.js
- Express.js
- Multer for handling file uploads
- Sharp for image processing and pixel manipulation

## Project Architecture

The application consists of two main components: the client and the server.

### Client

The React frontend provides the user interface and handles image uploads, filter selection, editing controls, and displaying processed images.

Key components include:

- **`App.js`** – Main application component that organizes the interface and its functionality.
- **`ImageUploader`** – Handles drag-and-drop uploads, sends images to the server, and displays the processed results. It also includes MSI decoding functionality.
- **`Filters`** – Provides the interface for selecting image filters and configuring their parameters.
- **`ZoomWrapper.js`** – Enables image zooming.
- **`App.css`** and **`filters.css`** – Define the application's styling.

### Server

The Node.js backend handles image uploads, processing, and communication with the frontend.

Key components include:

- **`server.js`** – Main server file responsible for receiving images, applying processing operations, and returning the results.
- **`msi.js`** – Handles MSI-related functionality.
- **`LogToFile`** – Records client requests and related logging information.

The Sharp library is used to convert images into pixel data, allowing image filters to manipulate the image contents.

## Getting Started

### Prerequisites

Make sure you have the following installed:

- [Node.js](https://nodejs.org/)
- npm (included with Node.js)

### Installation

1. Clone the repository:

   ```bash
   git clone <repository-url>
   ```

2. Navigate to the client directory and install its dependencies:

   ```bash
   cd <client-directory>
   npm install
   ```

3. Navigate to the server directory and install its dependencies:

   ```bash
   cd <server-directory>
   npm install
   ```

Replace the directory placeholders with the actual names used in your project.

### Running the Application

**1. Start the server**

From the server directory, run:

```bash
node server.js
```

**2. Start the client**

From the client directory, run:

```bash
npm start
```

Once both parts are running, open the local address provided by the React development server in your browser.

## How to Use

1. Launch the application.
2. Upload an image by dragging and dropping it into the designated area.
3. Select **Single** or **Batch** mode.
4. Choose an image filter and configure its parameters if available.
5. Click **Edit!** to send the image to the server for processing.
6. Compare the original and processed images using **Compare**.
7. Exit comparison mode to return to the edited image.
8. Use **Undo** or **Redo** to navigate through recent editing states.
9. Select an output format using **Download As**, or use **Save As** to save the processed image.

## Testing and Performance

The application was tested by applying ten image filters consecutively and measuring the processing times using server logs.

The logs record client requests and the time required for the server to respond, making it possible to analyze image-processing performance.

The documented test results indicate that:

- **Bill Atkinson** had the longest processing time among the tested filters.
- **Invert** had the shortest processing time among the tested filters.

Processing times were measured in milliseconds (ms).

## Project Structure

The following is a conceptual overview of the main application components. Adjust the paths to match the actual repository structure.

```text
project/
├── client/
│   ├── src/
│   │   ├── App.js
│   │   ├── ImageUploader.js
│   │   ├── Filters.js
│   │   ├── ZoomWrapper.js
│   │   ├── App.css
│   │   └── filters.css
│   └── package.json
│
└── server/
    ├── server.js
    ├── msi.js
    ├── package.json
    └── log file
```

## Future Improvements

Potential improvements include expanding the filter collection, optimizing processing performance, and adding more detailed performance tests across different image sizes and formats.

---

**MMS – Image Processing Application**

Built with React.js and Node.js.

