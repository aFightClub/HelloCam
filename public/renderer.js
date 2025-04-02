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

  // Crop mask elements
  const cropMask = document.getElementById("crop-mask");
  const cropPreviewContainer = document.querySelector(
    ".crop-preview-container"
  );
  const handles = {
    tl: document.getElementById("handle-tl"),
    tr: document.getElementById("handle-tr"),
    bl: document.getElementById("handle-bl"),
    br: document.getElementById("handle-br"),
  };

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
  const webcamWrapper = document.querySelector(".webcam-wrapper");

  let currentStream = null;
  let currentFilter = "none";
  let currentShape = "widescreen";
  let isPinned = false;
  let currentWidth = 400;

  // Crop variables
  let cropX = 0;
  let cropY = 0;
  let cropWidth = 0;
  let cropHeight = 0;
  let isDragging = false;
  let isResizing = false;
  let activeHandle = null;
  let dragStartX = 0;
  let dragStartY = 0;
  let initialCropX = 0;
  let initialCropY = 0;
  let initialCropWidth = 0;
  let initialCropHeight = 0;

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

      // Update crop mask position if active
      if (cropMask.style.display === "block") {
        updateCropMaskSize();
      }
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

    // Set up crop mask drag functionality
    setupCropMaskDragging();

    // Set up resize handle functionality
    setupHandleResizing();

    // Initial display of crop mask
    updateCropMaskSize();
    cropMask.style.display = "block";

    // Set initial aspect ratio
    applyAspectRatio("widescreen");
  }

  // Set up crop mask drag events
  function setupCropMaskDragging() {
    // Mouse down on crop mask - start dragging
    cropMask.addEventListener("mousedown", (e) => {
      // Don't handle if clicking on a resize handle
      if (e.target.classList.contains("crop-handle")) {
        return;
      }

      isDragging = true;
      cropMask.classList.add("dragging");

      // Record initial positions
      dragStartX = e.clientX;
      dragStartY = e.clientY;
      initialCropX = cropX;
      initialCropY = cropY;

      e.preventDefault();
    });

    // Mouse move - update position while dragging
    document.addEventListener("mousemove", (e) => {
      // Handle dragging the crop mask
      if (isDragging) {
        // Calculate the delta movement
        const deltaX = e.clientX - dragStartX;
        const deltaY = e.clientY - dragStartY;

        // Update crop position
        const containerRect = cropPreviewContainer.getBoundingClientRect();

        // Calculate new position relative to the crop container
        let newLeft = initialCropX + deltaX - containerRect.left;
        let newTop = initialCropY + deltaY - containerRect.top;

        // Constrain to bounds
        const maxLeft = containerRect.width - cropWidth;
        const maxTop = containerRect.height - cropHeight;

        newLeft = Math.max(0, Math.min(maxLeft, newLeft));
        newTop = Math.max(0, Math.min(maxTop, newTop));

        // Store absolute position for calculations
        cropX = newLeft + containerRect.left;
        cropY = newTop + containerRect.top;

        // Update position relative to container
        cropMask.style.left = `${newLeft}px`;
        cropMask.style.top = `${newTop}px`;
        cropMask.style.transform = "none"; // Remove the transform for direct positioning

        // Redraw canvas with the cropped area
        drawCroppedAreaToCanvas();
      }

      // Handle resizing with corner handles
      if (isResizing && activeHandle) {
        const containerRect = cropPreviewContainer.getBoundingClientRect();
        const aspectRatio = getCropAspectRatio();

        let newWidth, newHeight, newX, newY;

        // Calculate position relative to container
        const relativeInitialX = initialCropX - containerRect.left;
        const relativeInitialY = initialCropY - containerRect.top;

        switch (activeHandle) {
          case "tl": // Top left
            newWidth = initialCropWidth - (e.clientX - dragStartX);
            newHeight = newWidth / aspectRatio;

            // Apply size constraints
            newWidth = Math.min(
              Math.max(50, newWidth), // Min width 50px
              relativeInitialX + initialCropWidth // Don't go beyond right edge
            );
            newHeight = newWidth / aspectRatio;

            newX = relativeInitialX + initialCropWidth - newWidth;
            newY = relativeInitialY + initialCropHeight - newHeight;
            break;

          case "tr": // Top right
            newWidth = initialCropWidth + (e.clientX - dragStartX);
            newHeight = newWidth / aspectRatio;

            // Apply size constraints
            newWidth = Math.min(
              Math.max(50, newWidth), // Min width 50px
              containerRect.width - relativeInitialX // Don't go beyond right edge
            );
            newHeight = newWidth / aspectRatio;

            newX = relativeInitialX;
            newY = relativeInitialY + initialCropHeight - newHeight;
            break;

          case "bl": // Bottom left
            newWidth = initialCropWidth - (e.clientX - dragStartX);
            newHeight = newWidth / aspectRatio;

            // Apply size constraints
            newWidth = Math.min(
              Math.max(50, newWidth), // Min width 50px
              relativeInitialX + initialCropWidth // Don't go beyond right edge
            );
            newHeight = newWidth / aspectRatio;

            newX = relativeInitialX + initialCropWidth - newWidth;
            newY = relativeInitialY;
            break;

          case "br": // Bottom right
            newWidth = initialCropWidth + (e.clientX - dragStartX);
            newHeight = newWidth / aspectRatio;

            // Apply size constraints
            newWidth = Math.min(
              Math.max(50, newWidth), // Min width 50px
              containerRect.width - relativeInitialX // Don't go beyond right edge
            );
            newHeight = newWidth / aspectRatio;

            newX = relativeInitialX;
            newY = relativeInitialY;
            break;
        }

        // Update crop dimensions (relative to container)
        cropX = newX + containerRect.left;
        cropY = newY + containerRect.top;
        cropWidth = newWidth;
        cropHeight = newHeight;

        // Update mask position and size
        cropMask.style.left = `${newX}px`;
        cropMask.style.top = `${newY}px`;
        cropMask.style.width = `${cropWidth}px`;
        cropMask.style.height = `${cropHeight}px`;
        cropMask.style.transform = "none"; // Remove transform for direct positioning

        // Redraw canvas
        drawCroppedAreaToCanvas();
      }
    });

    // Mouse up - end dragging/resizing
    document.addEventListener("mouseup", () => {
      if (isDragging) {
        isDragging = false;
        cropMask.classList.remove("dragging");
      }

      if (isResizing) {
        isResizing = false;
        activeHandle = null;
      }
    });
  }

  // Set up resize handle events
  function setupHandleResizing() {
    // Add resize events to all handles
    Object.entries(handles).forEach(([position, handle]) => {
      handle.addEventListener("mousedown", (e) => {
        isResizing = true;
        activeHandle = position;

        // Record starting positions
        dragStartX = e.clientX;
        dragStartY = e.clientY;
        initialCropX = cropX;
        initialCropY = cropY;
        initialCropWidth = cropWidth;
        initialCropHeight = cropHeight;

        e.stopPropagation();
        e.preventDefault();
      });
    });
  }

  // Get current aspect ratio for crop
  function getCropAspectRatio() {
    switch (currentShape) {
      case "widescreen":
        return 16 / 9;
      case "square":
        return 1;
      case "portrait":
        return 9 / 16;
      default:
        return 16 / 9;
    }
  }

  // Update crop mask size based on aspect ratio
  function updateCropMaskSize() {
    const containerRect = cropPreviewContainer.getBoundingClientRect();

    // Calculate mask dimensions based on current aspect ratio
    const aspectRatio = getCropAspectRatio();

    // Default to 70% of container width
    cropWidth = containerRect.width * 0.7;

    // But ensure height doesn't exceed container
    const calculatedHeight = cropWidth / aspectRatio;
    if (calculatedHeight > containerRect.height * 0.8) {
      // If too tall, base on height instead
      cropHeight = containerRect.height * 0.8;
      cropWidth = cropHeight * aspectRatio;
    } else {
      cropHeight = calculatedHeight;
    }

    // Center the mask in the container
    const newLeft = (containerRect.width - cropWidth) / 2;
    const newTop = (containerRect.height - cropHeight) / 2;

    // Store absolute position for calculations
    cropX = newLeft + containerRect.left;
    cropY = newTop + containerRect.top;

    // Apply to element (relative to container)
    cropMask.style.width = `${cropWidth}px`;
    cropMask.style.height = `${cropHeight}px`;
    cropMask.style.left = `${newLeft}px`;
    cropMask.style.top = `${newTop}px`;
    cropMask.style.transform = "none"; // Remove default transform

    // Apply border radius to mask to match preview
    const borderRadius = styleInputs.borderRadius.value;
    cropMask.style.borderRadius = `${borderRadius}%`;
  }

  // Draw the cropped area to the canvas
  function drawCroppedAreaToCanvas() {
    if (!currentStream || videoElement.readyState < 2) return;

    // Get relative positions
    const videoRect = videoElement.getBoundingClientRect();

    // Calculate crop relative to video
    const relX = cropX - videoRect.left;
    const relY = cropY - videoRect.top;

    // Calculate the scale factors between video and display
    const scaleX = videoElement.videoWidth / videoRect.width;
    const scaleY = videoElement.videoHeight / videoRect.height;

    // Calculate source coordinates (from video)
    const sourceX = relX * scaleX;
    const sourceY = relY * scaleY;
    const sourceWidth = cropWidth * scaleX;
    const sourceHeight = cropHeight * scaleY;

    // Set canvas dimensions to match crop size
    canvasElement.width = cropWidth;
    canvasElement.height = cropHeight;

    // Draw the cropped region to the canvas
    ctx.clearRect(0, 0, canvasElement.width, canvasElement.height);
    ctx.drawImage(
      videoElement,
      Math.max(0, sourceX),
      Math.max(0, sourceY),
      sourceWidth,
      sourceHeight,
      0,
      0,
      canvasElement.width,
      canvasElement.height
    );
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
      startButton.textContent = "Start";
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

      // Get crop data as normalized coordinates (0-1) for the source video
      const videoRect = videoElement.getBoundingClientRect();
      const cropData = {
        x: Math.max(0, (cropX - videoRect.left) / videoRect.width),
        y: Math.max(0, (cropY - videoRect.top) / videoRect.height),
        width: cropWidth / videoRect.width,
        height: cropHeight / videoRect.height,
      };

      // Collect current configuration
      const styleConfig = {
        width: currentWidth,
        filter: currentFilter,
        borderRadius: styleInputs.borderRadius.value,
        borderWidth: styleInputs.borderWidth.value,
        borderColor: styleInputs.borderColor.value,
        cropData: cropData,
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

    // Update crop mask border radius
    if (cropMask) {
      cropMask.style.borderRadius = `${borderRadius}%`;
    }
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

    // Update crop mask to match new aspect ratio
    updateCropMaskSize();
    drawCroppedAreaToCanvas();
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

      // Make sure webcam wrapper is visible with proper size
      webcamWrapper.style.display = "block";
      videoElement.style.opacity = "1";

      // Set buttons
      startButton.textContent = "Restart";
      endButton.disabled = false;
      pinButton.disabled = false;

      // Set up canvas and crop mask after video metadata is loaded
      videoElement.onloadedmetadata = () => {
        // Wait a bit for the video to stabilize
        setTimeout(() => {
          videoElement.play();

          // Set canvas dimensions based on video
          canvasElement.width = videoElement.videoWidth || 640;
          canvasElement.height = videoElement.videoHeight || 480;

          // Apply current width
          canvasElement.style.width = `${currentWidth}px`;

          // Apply current aspect ratio
          applyAspectRatio(currentShape);

          // Apply border styles
          updateBorderStyles();

          // Make sure crop mask is showing
          updateCropMaskSize();
          cropMask.style.display = "block";

          // Initial draw to canvas to show image
          drawCroppedAreaToCanvas();
        }, 500);
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
      // Draw the cropped area to canvas
      drawCroppedAreaToCanvas();
    }
    requestAnimationFrame(updateCanvas);
  }

  // Start the canvas update loop
  updateCanvas();

  // Initialize the UI
  initializeUI();
});
