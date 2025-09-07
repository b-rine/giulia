/**
 * Julia Set WebGL Viewer
 * A beginner-friendly implementation of Julia set fractal rendering using WebGL
 */

class JuliaSetViewer {
    constructor() {
        this.canvas = document.getElementById('julia-canvas');
        this.gl = null;
        this.program = null;
        
        // Julia set parameters
        this.juliaReal = -0.7;      // Real part of the complex parameter c
        this.juliaImag = 0.27015;   // Imaginary part of the complex parameter c
        this.zoom = 1.0;            // Zoom level
        this.offsetX = 0.0;         // Pan offset X
        this.offsetY = 0.0;         // Pan offset Y
        this.maxIterations = 100;   // Maximum iterations for convergence test
        
        // Mouse interaction
        this.isDragging = false;
        this.lastMouseX = 0;
        this.lastMouseY = 0;
        
        // UI state
        this.controlsVisible = false;
        
        this.init();
    }
    
    /**
     * Initialize the WebGL context and set up the program
     */
    init() {
        try {
            // Set canvas size to match viewport
            this.resizeCanvas();
            
            // Get WebGL context
            this.gl = this.canvas.getContext('webgl') || this.canvas.getContext('experimental-webgl');
            
            if (!this.gl) {
                throw new Error('WebGL not supported');
            }
            
            console.log('WebGL context created successfully');
            
            // Create shader program
            this.createShaderProgram();
            
            // Set up the geometry (a simple quad that fills the screen)
            this.setupGeometry();
            
            // Set up event listeners
            this.setupEventListeners();
            
            // Set up UI event listeners
            this.setupUIEventListeners();
            
            // Hide loading indicator
            document.getElementById('loading').classList.remove('show');
            
            // Initial render
            this.render();
            
        } catch (error) {
            console.error('Failed to initialize WebGL:', error);
            this.showError('WebGL initialization failed: ' + error.message);
        }
    }
    
    /**
     * Resize canvas to match viewport
     */
    resizeCanvas() {
        const devicePixelRatio = window.devicePixelRatio || 1;
        const displayWidth = window.innerWidth;
        const displayHeight = window.innerHeight;
        
        // Set the canvas size in CSS pixels
        this.canvas.style.width = displayWidth + 'px';
        this.canvas.style.height = displayHeight + 'px';
        
        // Set the canvas resolution (considering device pixel ratio for crisp rendering)
        this.canvas.width = displayWidth * devicePixelRatio;
        this.canvas.height = displayHeight * devicePixelRatio;
        
        if (this.gl) {
            this.gl.viewport(0, 0, this.canvas.width, this.canvas.height);
            this.render();
        }
    }
    
    /**
     * Create and compile vertex and fragment shaders
     */
    createShaderProgram() {
        const vertexShaderSource = `
            // Vertex shader: positions vertices of our quad
            attribute vec2 a_position;
            varying vec2 v_texCoord;
            
            void main() {
                // Convert from clip space to texture coordinates
                v_texCoord = a_position * 0.5 + 0.5;
                gl_Position = vec4(a_position, 0.0, 1.0);
            }
        `;
        
        const fragmentShaderSource = `
            // Fragment shader: calculates Julia set for each pixel
            precision mediump float;
            
            varying vec2 v_texCoord;
            
            // Uniforms (parameters we can change from JavaScript)
            uniform vec2 u_julia_c;        // Complex parameter c (real, imaginary)
            uniform float u_zoom;          // Zoom level
            uniform vec2 u_offset;         // Pan offset
            uniform int u_max_iterations;  // Maximum iterations
            uniform vec2 u_resolution;     // Canvas resolution
            
            void main() {
                // Convert screen coordinates to complex plane coordinates
                vec2 uv = v_texCoord;
                
                // Map to complex plane with zoom and offset
                float aspect = u_resolution.x / u_resolution.y;
                vec2 c = u_julia_c;
                vec2 z = ((uv - 0.5) * 2.0) / u_zoom + u_offset;
                z.x *= aspect;  // Correct aspect ratio
                
                // Julia set iteration
                int iterations = 0;
                for (int i = 0; i < 500; i++) {  // WebGL requires constant loop bounds
                    if (i >= u_max_iterations) break;
                    
                    // Check if point has escaped (magnitude > 2)
                    if (dot(z, z) > 4.0) break;
                    
                    // Julia set formula: z = z^2 + c
                    float new_x = z.x * z.x - z.y * z.y + c.x;
                    float new_y = 2.0 * z.x * z.y + c.y;
                    z = vec2(new_x, new_y);
                    
                    iterations++;
                }
                
                // Color based on iterations (smooth coloring)
                if (iterations == u_max_iterations) {
                    // Point is in the set - color it black
                    gl_FragColor = vec4(0.0, 0.0, 0.0, 1.0);
                } else {
                    // Point escaped - color based on how quickly it escaped
                    float t = float(iterations) / float(u_max_iterations);
                    
                    // Create beautiful gradient colors
                    vec3 color1 = vec3(0.1, 0.2, 0.5);  // Dark blue
                    vec3 color2 = vec3(0.3, 0.8, 0.9);  // Cyan
                    vec3 color3 = vec3(1.0, 0.4, 0.4);  // Pink/red
                    vec3 color4 = vec3(1.0, 1.0, 0.5);  // Yellow
                    
                    vec3 color;
                    if (t < 0.33) {
                        color = mix(color1, color2, t * 3.0);
                    } else if (t < 0.66) {
                        color = mix(color2, color3, (t - 0.33) * 3.0);
                    } else {
                        color = mix(color3, color4, (t - 0.66) * 3.0);
                    }
                    
                    gl_FragColor = vec4(color, 1.0);
                }
            }
        `;
        
        // Compile shaders
        const vertexShader = this.compileShader(vertexShaderSource, this.gl.VERTEX_SHADER);
        const fragmentShader = this.compileShader(fragmentShaderSource, this.gl.FRAGMENT_SHADER);
        
        // Create program
        this.program = this.gl.createProgram();
        this.gl.attachShader(this.program, vertexShader);
        this.gl.attachShader(this.program, fragmentShader);
        this.gl.linkProgram(this.program);
        
        if (!this.gl.getProgramParameter(this.program, this.gl.LINK_STATUS)) {
            throw new Error('Unable to initialize shader program: ' + this.gl.getProgramInfoLog(this.program));
        }
        
        console.log('Shader program created successfully');
    }
    
    /**
     * Compile a shader from source code
     */
    compileShader(source, type) {
        const shader = this.gl.createShader(type);
        this.gl.shaderSource(shader, source);
        this.gl.compileShader(shader);
        
        if (!this.gl.getShaderParameter(shader, this.gl.COMPILE_STATUS)) {
            const error = this.gl.getShaderInfoLog(shader);
            this.gl.deleteShader(shader);
            throw new Error('An error occurred compiling the shaders: ' + error);
        }
        
        return shader;
    }
    
    /**
     * Set up the geometry (a simple quad covering the entire screen)
     */
    setupGeometry() {
        // Create a buffer for the quad's positions
        const positionBuffer = this.gl.createBuffer();
        this.gl.bindBuffer(this.gl.ARRAY_BUFFER, positionBuffer);
        
        // Define the quad (two triangles making a rectangle)
        const positions = [
            -1.0, -1.0,  // Bottom left
             1.0, -1.0,  // Bottom right
            -1.0,  1.0,  // Top left
             1.0,  1.0,  // Top right
        ];
        
        this.gl.bufferData(this.gl.ARRAY_BUFFER, new Float32Array(positions), this.gl.STATIC_DRAW);
        
        // Get the location of the position attribute
        const positionAttributeLocation = this.gl.getAttribLocation(this.program, 'a_position');
        this.gl.enableVertexAttribArray(positionAttributeLocation);
        this.gl.vertexAttribPointer(positionAttributeLocation, 2, this.gl.FLOAT, false, 0, 0);
    }
    
    /**
     * Set up event listeners for user interaction
     */
    setupEventListeners() {
        // Control sliders
        const realSlider = document.getElementById('param-real');
        const imagSlider = document.getElementById('param-imag');
        const zoomSlider = document.getElementById('zoom');
        const iterSlider = document.getElementById('iterations');
        
        const realValue = document.getElementById('real-value');
        const imagValue = document.getElementById('imag-value');
        const zoomValue = document.getElementById('zoom-value');
        const iterValue = document.getElementById('iter-value');
        
        realSlider.addEventListener('input', (e) => {
            this.juliaReal = parseFloat(e.target.value);
            realValue.textContent = this.juliaReal.toFixed(3);
            this.render();
        });
        
        imagSlider.addEventListener('input', (e) => {
            this.juliaImag = parseFloat(e.target.value);
            imagValue.textContent = this.juliaImag.toFixed(3);
            this.render();
        });
        
        zoomSlider.addEventListener('input', (e) => {
            this.zoom = parseFloat(e.target.value);
            zoomValue.textContent = this.zoom.toFixed(1);
            this.render();
        });
        
        iterSlider.addEventListener('input', (e) => {
            this.maxIterations = parseInt(e.target.value);
            iterValue.textContent = this.maxIterations;
            this.render();
        });
        
        // Preset buttons
        const presetButtons = document.querySelectorAll('.preset-btn');
        presetButtons.forEach(button => {
            button.addEventListener('click', () => {
                this.juliaReal = parseFloat(button.dataset.real);
                this.juliaImag = parseFloat(button.dataset.imag);
                
                realSlider.value = this.juliaReal;
                imagSlider.value = this.juliaImag;
                realValue.textContent = this.juliaReal.toFixed(3);
                imagValue.textContent = this.juliaImag.toFixed(3);
                
                this.render();
            });
        });
        
        // Mouse interaction for panning
        this.canvas.addEventListener('mousedown', (e) => {
            this.isDragging = true;
            this.lastMouseX = e.clientX;
            this.lastMouseY = e.clientY;
        });
        
        this.canvas.addEventListener('mousemove', (e) => {
            if (this.isDragging) {
                const deltaX = (e.clientX - this.lastMouseX) / this.canvas.width;
                const deltaY = (e.clientY - this.lastMouseY) / this.canvas.height;
                
                this.offsetX -= deltaX * 2.0 / this.zoom;
                this.offsetY += deltaY * 2.0 / this.zoom;
                
                this.lastMouseX = e.clientX;
                this.lastMouseY = e.clientY;
                
                this.render();
            }
        });
        
        document.addEventListener('mouseup', () => {
            this.isDragging = false;
        });
        
        // Zoom with mouse wheel
        this.canvas.addEventListener('wheel', (e) => {
            e.preventDefault();
            const zoomFactor = e.deltaY > 0 ? 0.9 : 1.1;
            this.zoom *= zoomFactor;
            this.zoom = Math.max(0.1, Math.min(10.0, this.zoom));  // Clamp zoom
            
            zoomSlider.value = this.zoom;
            zoomValue.textContent = this.zoom.toFixed(1);
            
            this.render();
        });
        
        // Window resize handler
        window.addEventListener('resize', () => {
            this.resizeCanvas();
        });
    }
    
    /**
     * Set up UI event listeners for controls panel
     */
    setupUIEventListeners() {
        const cogIcon = document.getElementById('cog-icon');
        const controlsPanel = document.getElementById('controls-panel');
        const closeButton = document.getElementById('close-controls');
        
        // Toggle controls panel
        cogIcon.addEventListener('click', () => {
            this.toggleControls();
        });
        
        // Close controls panel
        closeButton.addEventListener('click', () => {
            this.hideControls();
        });
        
        // Close controls when clicking outside (on canvas)
        this.canvas.addEventListener('click', (e) => {
            if (this.controlsVisible && !this.isDragging) {
                this.hideControls();
            }
        });
        
        // Prevent closing when clicking inside controls panel
        controlsPanel.addEventListener('click', (e) => {
            e.stopPropagation();
        });
    }
    
    /**
     * Toggle controls panel visibility
     */
    toggleControls() {
        const cogIcon = document.getElementById('cog-icon');
        const controlsPanel = document.getElementById('controls-panel');
        
        this.controlsVisible = !this.controlsVisible;
        
        if (this.controlsVisible) {
            controlsPanel.classList.add('show');
            cogIcon.classList.add('spinning');
            setTimeout(() => cogIcon.classList.remove('spinning'), 500);
        } else {
            controlsPanel.classList.remove('show');
        }
    }
    
    /**
     * Hide controls panel
     */
    hideControls() {
        const controlsPanel = document.getElementById('controls-panel');
        controlsPanel.classList.remove('show');
        this.controlsVisible = false;
    }
    
    /**
     * Render the Julia set
     */
    render() {
        // Set viewport
        this.gl.viewport(0, 0, this.canvas.width, this.canvas.height);
        
        // Clear the canvas
        this.gl.clearColor(0.0, 0.0, 0.0, 1.0);
        this.gl.clear(this.gl.COLOR_BUFFER_BIT);
        
        // Use our shader program
        this.gl.useProgram(this.program);
        
        // Set uniforms (parameters for the shader)
        const juliaCLocation = this.gl.getUniformLocation(this.program, 'u_julia_c');
        const zoomLocation = this.gl.getUniformLocation(this.program, 'u_zoom');
        const offsetLocation = this.gl.getUniformLocation(this.program, 'u_offset');
        const maxIterationsLocation = this.gl.getUniformLocation(this.program, 'u_max_iterations');
        const resolutionLocation = this.gl.getUniformLocation(this.program, 'u_resolution');
        
        this.gl.uniform2f(juliaCLocation, this.juliaReal, this.juliaImag);
        this.gl.uniform1f(zoomLocation, this.zoom);
        this.gl.uniform2f(offsetLocation, this.offsetX, this.offsetY);
        this.gl.uniform1i(maxIterationsLocation, this.maxIterations);
        this.gl.uniform2f(resolutionLocation, this.canvas.width, this.canvas.height);
        
        // Draw the quad (which will be processed by our fragment shader)
        this.gl.drawArrays(this.gl.TRIANGLE_STRIP, 0, 4);
    }
    
    /**
     * Show error message to user
     */
    showError(message) {
        const loading = document.getElementById('loading');
        loading.textContent = message;
        loading.classList.add('show');
        loading.style.background = 'rgba(200, 0, 0, 0.8)';
    }
}

// Initialize the Julia set viewer when the page loads
document.addEventListener('DOMContentLoaded', () => {
    console.log('Initializing Julia Set Viewer...');
    new JuliaSetViewer();
});

// Log to file as per user preference
function logToFile(message) {
    // In a real implementation, you might send this to a server
    // For now, we'll just use console.log with a file indicator
    console.log(`[LOG FILE] ${new Date().toISOString()}: ${message}`);
}

// Use logging for important events
logToFile('Julia Set Viewer initialized');
