pdfjsLib.GlobalWorkerOptions.workerSrc = 'https://cdnjs.cloudflare.com/ajax/libs/pdf.js/2.9.359/pdf.worker.min.js';

angular.module('pdfViewer', [])
.directive('pdfViewer', function($timeout) {
    return {
        restrict: 'E',
        template: `
        <div>
            <div class="pdf-container"></div>
            <div class="error" ng-if="error">{{error}}</div>
            <div class="info-panel">
                <h3>Square Positions</h3>
                <div ng-if="showFirstPage">
                    First Page: {{firstPagePosition}}
                </div>
                <div ng-if="showMiddlePages">
                    Middle Pages: {{middlePagesPosition}}
                </div>
                <div ng-if="showLastPage">
                    Last Page: {{lastPagePosition}}
                </div>
            </div>
            <div class="debug-info">{{debugInfo}}</div>
        </div>
        `,
        scope: {
            url: '@',
            showFirstPage: '=',
            showLastPage: '=',
            showMiddlePages: '='
        },
        link: function(scope, element, attrs) {
            var container = element[0].querySelector('.pdf-container');
            var pdfDoc = null;
            var pdfScale = 0.5; 
            var squareScale = 1.3334; 
            scope.debugInfo = '';

            function cmToPx(cm) {
                return cm * (96 / 2.54) / squareScale;
            }

            function pxToCm(px) {
                return (px * squareScale / (96 / 2.54)).toFixed(2);
            }

            scope.$watch('url', function(newUrl) {
                if (newUrl) {
                    loadPdf(newUrl);
                }
            });

            function loadPdf(url) {
                scope.debugInfo = 'Loading PDF: ' + url;
                pdfjsLib.getDocument(url).promise.then(function(pdf) {
                    pdfDoc = pdf;
                    scope.debugInfo += '\nPDF loaded successfully. Number of pages: ' + pdf.numPages;
                    scope.$apply();
                    renderPages();
                }).catch(function(error) {
                    scope.error = 'Error loading PDF: ' + error.message;
                    scope.debugInfo += '\nError loading PDF: ' + error.message;
                    scope.$apply();
                });
            }

            function renderPages() {
                container.innerHTML = ''; 
                for (var num = 1; num <= pdfDoc.numPages; num++) {
                    renderPage(num);
                }
            }

            function renderPage(num) {
                scope.debugInfo += '\nRendering page ' + num;
                scope.$apply();
                pdfDoc.getPage(num).then(function(page) {
                    var viewport = page.getViewport({scale: pdfScale});
                    var canvas = document.createElement('canvas');
                    var ctx = canvas.getContext('2d');
                    canvas.height = viewport.height;
                    canvas.width = viewport.width;

                    var renderContext = {
                        canvasContext: ctx,
                        viewport: viewport
                    };

                    var pageDiv = document.createElement('div');
                    pageDiv.className = 'page';
                    pageDiv.style.width = viewport.width + 'px';
                    pageDiv.style.height = viewport.height + 'px';
                    pageDiv.appendChild(canvas);

                    var pageNumberDiv = document.createElement('div');
                    pageNumberDiv.textContent = 'Page ' + num;
                    pageNumberDiv.style.textAlign = 'center';
                    pageNumberDiv.style.marginTop = '5px';

                    pageDiv.appendChild(pageNumberDiv);
                    container.appendChild(pageDiv);

                    page.render(renderContext).promise.then(function() {
                        scope.debugInfo += '\nPage ' + num + ' rendered successfully';
                        scope.$apply();
                        addSquare(pageDiv, num);
                    }).catch(function(error) {
                        scope.error = 'Error rendering page ' + num + ': ' + error.message;
                        scope.debugInfo += '\nError rendering page ' + num + ': ' + error.message;
                        scope.$apply();
                    });
                }).catch(function(error) {
                    scope.error = 'Error getting page ' + num + ': ' + error.message;
                    scope.debugInfo += '\nError getting page ' + num + ': ' + error.message;
                    scope.$apply();
                });
            }

            function addSquare(pageDiv, pageNum) {
                var square = document.createElement('div');
                square.className = 'square';
                square.style.width = cmToPx(1) + 'px';
                square.style.height = cmToPx(1) + 'px';

                var pageRect = pageDiv.getBoundingClientRect();
                var squareRect = square.getBoundingClientRect();

                var centerX = (pageRect.width - squareRect.width) / 2;
                var centerY = (pageRect.height - squareRect.height) / 2;

                square.style.left = centerX + 'px';
                square.style.top = centerY + 'px';

                var handle = document.createElement('div');
                handle.className = 'resize-handle';
                square.appendChild(handle);

                pageDiv.appendChild(square);

                setupDraggable(square, pageDiv, pageNum);
                setupResizable(square, pageDiv, pageNum);

                updateSquareVisibility(square, pageNum);
            }

            function setupDraggable(square, pageDiv, pageNum) {
                var isDragging = false;
                var startX, startY;

                square.addEventListener('mousedown', function(e) {
                    if (e.target.classList.contains('resize-handle')) return;
                    isDragging = true;
                    startX = e.clientX - square.offsetLeft;
                    startY = e.clientY - square.offsetTop;
                    e.preventDefault();
                });

                document.addEventListener('mousemove', function(e) {
                    if (!isDragging) return;
                    var newX = e.clientX - startX;
                    var newY = e.clientY - startY;
                    var pageRect = pageDiv.getBoundingClientRect();
                    var squareRect = square.getBoundingClientRect();

                    newX = Math.max(0, Math.min(newX, pageRect.width - squareRect.width));
                    newY = Math.max(0, Math.min(newY, pageRect.height - squareRect.height));

                    square.style.left = newX + 'px';
                    square.style.top = newY + 'px';

                    if (pageNum > 1 && pageNum < pdfDoc.numPages) {
                        updateAllMiddleSquares(newX, newY, squareRect.width, squareRect.height);
                    }

                    updatePositions();
                    scope.$apply();
                });

                document.addEventListener('mouseup', function() {
                    isDragging = false;
                });
            }

            function setupResizable(square, pageDiv, pageNum) {
                var isResizing = false;
                var startX, startY, startWidth, startHeight;

                square.querySelector('.resize-handle').addEventListener('mousedown', function(e) {
                    isResizing = true;
                    startX = e.clientX;
                    startY = e.clientY;
                    startWidth = parseInt(document.defaultView.getComputedStyle(square).width, 10);
                    startHeight = parseInt(document.defaultView.getComputedStyle(square).height, 10);
                    e.preventDefault();
                });

                document.addEventListener('mousemove', function(e) {
                    if (!isResizing) return;
                    
                    var dx = e.clientX - startX;
                    var dy = e.clientY - startY;
                 
                    var newSize = Math.max(startWidth + Math.max(dx, dy), cmToPx(1)); 
                    
                    var pageRect = pageDiv.getBoundingClientRect();
                    var squareRect = square.getBoundingClientRect();

                    var maxSizeWidth = pageRect.width - (squareRect.left - pageRect.left);
                    var maxSizeHeight = pageRect.height - (squareRect.top - pageRect.top);

                    newSize = Math.min(newSize, Math.min(maxSizeWidth, maxSizeHeight));

                    square.style.width = newSize + 'px';
                    square.style.height = newSize + 'px';

                    if (pageNum > 1 && pageNum < pdfDoc.numPages) {
                        updateAllMiddleSquares(square.offsetLeft, square.offsetTop, newSize, newSize);
                    }

                    updatePositions();
                    scope.$apply();
                });

                document.addEventListener('mouseup', function() {
                    isResizing = false;
                });
            }

            function updateAllMiddleSquares(left, top, width, height) {
                var squares = container.querySelectorAll('.square');
                squares.forEach(function(square, index) {
                    if (index > 0 && index < squares.length - 1) {
                        square.style.left = left + 'px';
                        square.style.top = top + 'px';
                        square.style.width = width + 'px';
                        square.style.height = height + 'px';
                    }
                });
            }

            function updatePositions() {
                try {
                    var squares = container.querySelectorAll('.square');
                    squares.forEach(function(square, index) {
                        var pageNum = index + 1;
                        var pageRect = square.parentElement.getBoundingClientRect();
                        var squareRect = square.getBoundingClientRect();
                        var position = {
                            left: pxToCm((squareRect.left - pageRect.left) / pdfScale),
                            bottom: pxToCm((pageRect.height - (squareRect.top - pageRect.top) - squareRect.height) / pdfScale),
                            width: pxToCm(squareRect.width / pdfScale)                            
                        };
                        position.bottom = Math.max(position.bottom, 0);
                        var positionString = `left: ${position.left}cm, bottom: ${position.bottom}cm, width: ${position.width}cm`;
                        
                        if (pageNum === 1) {
                            scope.firstPagePosition = positionString;
                        } else if (pageNum === pdfDoc.numPages) {
                            scope.lastPagePosition = positionString;
                        } else if (pageNum === 2) {
                            scope.middlePagesPosition = positionString;
                        }
                    });
                    console.log('Positions updated:', {
                        firstPagePosition: scope.firstPagePosition,
                        middlePagesPosition: scope.middlePagesPosition,
                        lastPagePosition: scope.lastPagePosition
                    });
                } catch (error) {
                    console.error('Error updating positions:', error);
                    scope.debugInfo += '\nError updating positions: ' + error.message;
                }
                scope.$apply();
            }

            function updateSquareVisibility(square, pageNum) {
                if (pageNum === 1) {
                    square.style.display = scope.showFirstPage ? 'block' : 'none';
                } else if (pageNum === pdfDoc.numPages) {
                    square.style.display = scope.showLastPage ? 'block' : 'none';
                } else {
                    square.style.display = scope.showMiddlePages ? 'block' : 'none';
                }
            }

            scope.$watch('showFirstPage', function() { updateSquares(); });
            scope.$watch('showLastPage', function() { updateSquares(); });
            scope.$watch('showMiddlePages', function() { updateSquares(); });

            function updateSquares() {
                var squares = container.querySelectorAll('.square');
                squares.forEach(function(square, index) {
                    updateSquareVisibility(square, index + 1);
                });
                updatePositions();
            }
        }
    };
})
.controller('PdfController', function($scope) {
    $scope.pdfUrl = '';
    $scope.showFirstPage = true;
    $scope.showLastPage = false;
    $scope.showMiddlePages = false;
    
    $scope.loadPdf = function(file) {
        if (file && file.type === "application/pdf") {
            $scope.pdfUrl = URL.createObjectURL(file);
            console.log('PDF URL created:', $scope.pdfUrl);
        } else {
            alert('Please select a valid PDF file.');
        }
    };

    $scope.updateSquares = function() {
        
    };
});