document.addEventListener("DOMContentLoaded", () => {
  // Check if electronAPI is available
  if (!window.electronAPI) {
    console.error(
      "Electron API is not available. Running in non-Electron environment or preload script failed to load."
    );
    alert(
      "Application is not properly initialized. Please restart the application."
    );
    return;
  }

  const videoElement = document.getElementById("webcam");
  const canvasElement = document.getElementById("preview");
  const startButton = document.getElementById("start-btn");
  const endButton = document.getElementById("end-btn");
  const pinButton = document.getElementById("pin-btn");
  const unpinButton = document.getElementById("unpin-btn");
  const ctx = canvasElement.getContext("2d");

  // Aspect ratio buttons
  const shapeButtons = {
    widescreen: document.getElementById("shape-widescreen"),
    square: document.getElementById("shape-square"),
    portrait: document.getElementById("shape-portrait"),
  };

  // Style inputs
  const styleInputs = {
    windowWidth: document.getElementById("window-width"),
    borderRadius: document.getElementById("border-radius"),
    borderWidth: document.getElementById("border-width"),
    borderColor: document.getElementById("border-color"),
  };

  // Value displays
  const valueDisplays = {
    windowWidth: document.getElementById("window-width-value"),
    borderRadius: document.getElementById("border-radius-value"),
    borderWidth: document.getElementById("border-width-value"),
  };

  // Container for aspect ratio
  const webcamSection = document.querySelector(".webcam-section");

  let currentStream = null;
  let currentFilter = "none";
  let currentShape = "widescreen";
  let isPinned = false;
  let currentWidth = 400;

  // Initialize UI based on inputs
  function initializeUI() {
    // Set default width
    canvasElement.style.width = `${currentWidth}px`;
    styleInputs.windowWidth.value = currentWidth;
    valueDisplays.windowWidth.textContent = `${currentWidth}px`;

    // Set default border values
    valueDisplays.borderRadius.textContent = `0%`;
    valueDisplays.borderWidth.textContent = `0px`;

    // Check if pinned window is already open
    try {
      window.electronAPI
        .isPinnedWindowOpen()
        .then((isOpen) => {
          if (isOpen) {
            setPinnedState(true);
          }
        })
        .catch((err) => {
          console.error("Error checking pinned window status:", err);
          // Continue initialization even if this fails
        });
    } catch (error) {
      console.error("Error calling isPinnedWindowOpen:", error);
    }

    // Set up border style input listeners
    styleInputs.borderRadius.addEventListener("input", updateBorderStyles);
    styleInputs.borderWidth.addEventListener("input", updateBorderStyles);
    styleInputs.borderColor.addEventListener("input", updateBorderStyles);

    // Set up window width control
    styleInputs.windowWidth.addEventListener("input", () => {
      currentWidth = styleInputs.windowWidth.value;
      valueDisplays.windowWidth.textContent = `${currentWidth}px`;
      canvasElement.style.width = `${currentWidth}px`;
    });

    // Set up shape button listeners
    Object.entries(shapeButtons).forEach(([shape, button]) => {
      button.addEventListener("click", () => {
        setActiveShapeButton(shape);
        applyAspectRatio(shape);
      });
    });

    // Set up pin button listener
    pinButton.addEventListener("click", createPinnedWindow);

    // Set up unpin button listener
    unpinButton.addEventListener("click", closePinnedWindow);

    // Set up end camera button listener
    endButton.addEventListener("click", stopCamera);

    // Set initial aspect ratio
    applyAspectRatio("widescreen");
  }

  // Stop the camera stream
  function stopCamera() {
    if (currentStream) {
      // Stop all tracks
      currentStream.getTracks().forEach((track) => track.stop());
      currentStream = null;

      // Clear video source
      videoElement.srcObject = null;

      // Reset buttons
      startButton.textContent = "Start Camera";
      startButton.disabled = false;
      endButton.disabled = true;
      pinButton.disabled = true;

      // Clear canvas
      ctx.clearRect(0, 0, canvasElement.width, canvasElement.height);

      console.log("Camera stopped");
    }
  }

  // Create pinned window
  async function createPinnedWindow() {
    try {
      // Ensure camera is active
      if (!currentStream) {
        alert("Please start the camera before pinning to desktop.");
        return;
      }

      // Collect current configuration
      const styleConfig = {
        width: currentWidth,
        filter: currentFilter,
        borderRadius: styleInputs.borderRadius.value,
        borderWidth: styleInputs.borderWidth.value,
        borderColor: styleInputs.borderColor.value,
      };

      // Create the pinned window
      const result = await window.electronAPI.createPinnedWindow({
        shape: currentShape,
        styleConfig,
      });

      if (result.success) {
        setPinnedState(true);
      }
    } catch (error) {
      console.error("Error creating pinned window:", error);
      alert("Failed to create pinned window: " + error.message);
    }
  }

  // Close pinned window
  async function closePinnedWindow() {
    try {
      const result = await window.electronAPI.closePinnedWindow();
      if (result) {
        setPinnedState(false);
      }
    } catch (error) {
      console.error("Error closing pinned window:", error);
    }
  }

  // Set UI state based on pinned status
  function setPinnedState(isPinned) {
    if (isPinned) {
      pinButton.style.display = "none";
      unpinButton.style.display = "inline-block";
      unpinButton.disabled = false;
    } else {
      pinButton.style.display = "inline-block";
      unpinButton.style.display = "none";
    }
  }

  // Update border styles based on inputs
  function updateBorderStyles() {
    const borderRadius = styleInputs.borderRadius.value;
    const borderWidth = styleInputs.borderWidth.value;
    const borderColor = styleInputs.borderColor.value;

    // Update border style display values
    valueDisplays.borderRadius.textContent = `${borderRadius}%`;
    valueDisplays.borderWidth.textContent = `${borderWidth}px`;

    // Apply styles to canvas
    canvasElement.style.borderRadius = `${borderRadius}%`;
    canvasElement.style.border = `${borderWidth}px solid ${borderColor}`;
  }

  // Set active shape button
  function setActiveShapeButton(shape) {
    Object.entries(shapeButtons).forEach(([key, button]) => {
      if (key === shape) {
        button.classList.add("active");
      } else {
        button.classList.remove("active");
      }
    });

    currentShape = shape;
  }

  // Apply aspect ratio styles to elements
  function applyAspectRatio(shape) {
    webcamSection.classList.remove(
      "widescreen-layout",
      "square-layout",
      "portrait-layout"
    );

    webcamSection.classList.add(`${shape}-layout`);

    // Reset width
    canvasElement.style.width = `${currentWidth}px`;

    // Apply aspect ratio
    switch (shape) {
      case "widescreen":
        canvasElement.style.aspectRatio = "16/9";
        break;
      case "square":
        canvasElement.style.aspectRatio = "1/1";
        break;
      case "portrait":
        canvasElement.style.aspectRatio = "9/16";
        break;
    }
  }

  // Start the webcam
  startButton.addEventListener("click", async () => {
    try {
      // First check if we already have a stream and stop it
      if (currentStream) {
        currentStream.getTracks().forEach((track) => track.stop());
      }

      const constraints = {
        video: {
          width: { ideal: 1280 },
          height: { ideal: 720 },
        },
        audio: false,
      };

      // Try to access the camera
      const stream = await navigator.mediaDevices.getUserMedia(constraints);

      // If we get here, we have camera access
      videoElement.srcObject = stream;
      currentStream = stream;

      startButton.textContent = "Restart";
      endButton.disabled = false;
      pinButton.disabled = false;

      // Set up canvas size after video metadata is loaded
      videoElement.onloadedmetadata = () => {
        canvasElement.width = videoElement.videoWidth || 640;
        canvasElement.height = videoElement.videoHeight || 480;

        // Apply current width
        canvasElement.style.width = `${currentWidth}px`;

        // Apply current aspect ratio
        applyAspectRatio(currentShape);

        // Apply border styles
        updateBorderStyles();
      };

      // Check if pinned window is already open
      try {
        const isPinned = await window.electronAPI.isPinnedWindowOpen();
        setPinnedState(isPinned);
      } catch (error) {
        console.error("Error checking pinned status:", error);
        // Default to unpinned state if check fails
        setPinnedState(false);
      }
    } catch (err) {
      console.error("Error accessing camera: ", err);

      // More helpful error message based on error type
      if (
        err.name === "NotAllowedError" ||
        err.name === "PermissionDeniedError"
      ) {
        alert(
          "Camera access was denied. Please allow camera access in your browser settings."
        );
      } else if (
        err.name === "NotFoundError" ||
        err.name === "DevicesNotFoundError"
      ) {
        alert("No camera device was found on your system.");
      } else if (
        err.name === "NotReadableError" ||
        err.name === "TrackStartError"
      ) {
        alert("Camera is already in use by another application.");
      } else {
        alert("Could not access camera. Error: " + err.message);
      }
    }
  });

  // Draw webcam to canvas
  function updateCanvas() {
    if (currentStream && videoElement.readyState >= 2) {
      // Draw the video frame to the canvas (unfiltered)
      ctx.drawImage(
        videoElement,
        0,
        0,
        canvasElement.width,
        canvasElement.height
      );
    }
    requestAnimationFrame(updateCanvas);
  }

  // Start the canvas update loop
  updateCanvas();

  // Initialize the UI
  initializeUI();
});
