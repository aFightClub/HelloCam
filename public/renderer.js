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

  // Create a background element for the crop preview
  const cropBackground = document.createElement("div");
  cropBackground.className = "crop-preview-background";
  cropPreviewContainer.appendChild(cropBackground);

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

  // Normalized crop coordinates (0-1) for video
  let normalizedCrop = {
    x: 0.25,
    y: 0.25,
    width: 0.5,
    height: 0.5,
  };

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

        // Calculate normalized crop coordinates (0-1) based on crop container size
        updateNormalizedCropCoordinates(newLeft, newTop, containerRect);

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

        // Calculate normalized crop coordinates (0-1)
        updateNormalizedCropCoordinates(newX, newY, containerRect);

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

  function updateNormalizedCropCoordinates(x, y, containerRect) {
    // Calculate normalized crop coordinates (0-1) based on crop container size
    normalizedCrop = {
      x: x / containerRect.width,
      y: y / containerRect.height,
      width: cropWidth / containerRect.width,
      height: cropHeight / containerRect.height,
    };
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

    // Get webcam's natural aspect ratio if available
    let aspectRatio = getCropAspectRatio(); // Default from selected aspect ratio
    if (videoElement.videoWidth && videoElement.videoHeight) {
      // If webcam is active, use its natural aspect ratio for the crop mask
      const naturalRatio = videoElement.videoWidth / videoElement.videoHeight;

      // Calculate how the video fits in the container (maintain aspect ratio)
      let videoDisplayWidth, videoDisplayHeight;

      if (naturalRatio > containerRect.width / containerRect.height) {
        // Video is wider than container - width matches
        videoDisplayWidth = containerRect.width;
        videoDisplayHeight = videoDisplayWidth / naturalRatio;
      } else {
        // Video is taller than container - height matches
        videoDisplayHeight = containerRect.height;
        videoDisplayWidth = videoDisplayHeight * naturalRatio;
      }

      // Start with mask at 70% of the displayed video size
      cropWidth = videoDisplayWidth * 0.7;
      cropHeight = cropWidth / aspectRatio;

      // Make sure crop height doesn't exceed the video height
      if (cropHeight > videoDisplayHeight) {
        cropHeight = videoDisplayHeight * 0.7;
        cropWidth = cropHeight * aspectRatio;
      }
    } else {
      // Fallback if video dimensions aren't available yet
      cropWidth = containerRect.width * 0.7;
      cropHeight = cropWidth / aspectRatio;

      // Ensure height doesn't exceed container
      if (cropHeight > containerRect.height * 0.8) {
        cropHeight = containerRect.height * 0.8;
        cropWidth = cropHeight * aspectRatio;
      }
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

    // Update normalized coordinates
    updateNormalizedCropCoordinates(newLeft, newTop, containerRect);

    // Apply border radius to mask to match preview
    const borderRadius = styleInputs.borderRadius.value;
    cropMask.style.borderRadius = `${borderRadius}%`;
  }

  // Draw the cropped area to the canvas
  function drawCroppedAreaToCanvas() {
    if (!currentStream || videoElement.readyState < 2) return;

    // Get video dimensions
    const videoWidth = videoElement.videoWidth;
    const videoHeight = videoElement.videoHeight;

    // Calculate how the video fits in the crop container (similar to object-fit: contain)
    const containerRect = cropPreviewContainer.getBoundingClientRect();
    const containerRatio = containerRect.width / containerRect.height;
    const videoRatio = videoWidth / videoHeight;

    let displayWidth, displayHeight, offsetX, offsetY;

    if (videoRatio > containerRatio) {
      // Video is wider than container - width matches
      displayWidth = containerRect.width;
      displayHeight = displayWidth / videoRatio;
      offsetX = 0;
      offsetY = (containerRect.height - displayHeight) / 2;
    } else {
      // Video is taller than container - height matches
      displayHeight = containerRect.height;
      displayWidth = displayHeight * videoRatio;
      offsetX = (containerRect.width - displayWidth) / 2;
      offsetY = 0;
    }

    // Calculate crop position relative to the displayed video
    const relativeX = (cropX - containerRect.left - offsetX) / displayWidth;
    const relativeY = (cropY - containerRect.top - offsetY) / displayHeight;
    const relativeWidth = cropWidth / displayWidth;
    const relativeHeight = cropHeight / displayHeight;

    // Calculate source coordinates in the actual video
    const sourceX = Math.max(0, relativeX * videoWidth);
    const sourceY = Math.max(0, relativeY * videoHeight);
    const sourceWidth = Math.min(
      relativeWidth * videoWidth,
      videoWidth - sourceX
    );
    const sourceHeight = Math.min(
      relativeHeight * videoHeight,
      videoHeight - sourceY
    );

    // Update normalized crop data
    normalizedCrop = {
      x: relativeX,
      y: relativeY,
      width: relativeWidth,
      height: relativeHeight,
    };

    // Set canvas dimensions to match crop size
    canvasElement.width = sourceWidth;
    canvasElement.height = sourceHeight;

    // Clear canvas
    ctx.clearRect(0, 0, canvasElement.width, canvasElement.height);

    // Draw the cropped region to the canvas
    ctx.drawImage(
      videoElement,
      sourceX,
      sourceY,
      sourceWidth,
      sourceHeight,
      0,
      0,
      canvasElement.width,
      canvasElement.height
    );

    // Set the canvas size based on the aspect ratio and available space
    const webcamRect = webcamWrapper.getBoundingClientRect();
    const maxPreviewWidth = webcamRect.width * 0.9;
    const maxPreviewHeight = webcamRect.height * 0.9;

    // Determine the display size while maintaining aspect ratio
    const previewRatio = canvasElement.width / canvasElement.height;

    if (previewRatio > maxPreviewWidth / maxPreviewHeight) {
      // Preview is wider than container
      canvasElement.style.width = `${maxPreviewWidth}px`;
      canvasElement.style.height = "auto";
    } else {
      // Preview is taller than container
      canvasElement.style.height = `${maxPreviewHeight}px`;
      canvasElement.style.width = "auto";
    }
  }

  // Capture a frame from the video to display in crop preview
  function captureVideoFrame() {
    if (!videoElement || videoElement.readyState < 2) return null;

    const tempCanvas = document.createElement("canvas");
    tempCanvas.width = videoElement.videoWidth;
    tempCanvas.height = videoElement.videoHeight;

    const tempCtx = tempCanvas.getContext("2d");
    tempCtx.drawImage(videoElement, 0, 0, tempCanvas.width, tempCanvas.height);

    try {
      return tempCanvas.toDataURL("image/jpeg", 0.7);
    } catch (e) {
      console.error("Error capturing video frame:", e);
      return null;
    }
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

      // Clear crop preview background
      cropBackground.style.backgroundImage = "";
      cropBackground.style.display = "none";

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

      // Use normalized crop coordinates
      const cropData = {
        x: normalizedCrop.x,
        y: normalizedCrop.y,
        width: normalizedCrop.width,
        height: normalizedCrop.height,
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
    document
      .querySelector(".left-panel")
      .classList.remove(
        "widescreen-layout",
        "square-layout",
        "portrait-layout"
      );

    document.querySelector(".left-panel").classList.add(`${shape}-layout`);

    // Set current shape
    currentShape = shape;

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

      // Make webcam element visible
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

          // Apply current aspect ratio
          applyAspectRatio(currentShape);

          // Apply border styles
          updateBorderStyles();

          // Update crop mask position
          updateCropMaskSize();
          cropMask.style.display = "block";

          // Update crop preview background
          updateCropPreviewBackground();

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

  // Update the crop preview background
  function updateCropPreviewBackground() {
    if (!currentStream || videoElement.readyState < 2) return;

    const videoUrl = captureVideoFrame();
    if (videoUrl) {
      cropBackground.style.backgroundImage = `url(${videoUrl})`;
      cropBackground.style.display = "block";
      cropBackground.style.opacity = "0.8"; // Make it visible but not too bright
    }
  }

  // Draw webcam to canvas
  function updateCanvas() {
    if (currentStream && videoElement.readyState >= 2) {
      // Draw the cropped area to canvas
      drawCroppedAreaToCanvas();

      // Update crop preview background every second
      if (Date.now() % 1000 < 50) {
        updateCropPreviewBackground();
      }
    }
    requestAnimationFrame(updateCanvas);
  }

  // Start the canvas update loop
  updateCanvas();

  // Initialize the UI
  initializeUI();
});
