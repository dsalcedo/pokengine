File = {
	loadFileOfType : function (store, object, loadEvent, dataForFile, directory, filetype, paths, uponLoad, uponError, redirectedPaths) {
		if (!Files.hasOwnProperty(store))
			Files[store] = {};
		var substore = store;
		store = Files[store];
		paths = wrapArray(paths);
		redirectedPaths = redirectedPaths || [];
		var path = paths.shift();
		if (/(.*)\.(\w+)/.test(path))
			path = path.match(/(.*)\.(\w+)/)[1];
		var successful = function (data) {
			foreach(redirectedPaths.concat(path), function (redirect) {
				store[redirect] = data;
			});
			if (uponLoad)
				uponLoad(data);
		};
		if (store.hasOwnProperty(path)) {
			successful(store[path]);
			return store[path];
		}
		var file = new object();
		file.src = (!(path.substr(0, 5) === "data:" || path.substr(0, 5) === "http:" || path.substr(0, 6) === "https:") ? directory + "/" + path + "." + filetype : path);
		store[path] = null;
		file.addEventListener(loadEvent, function (event) {
			successful(dataForFile(event, file, store, path));
		});
		file.addEventListener("error", function (message, url, line) {
			delete store[path];
			redirectedPaths.push(path);
			if (paths.notEmpty()) {
				File.load(substore, object, loadEvent, dataForFile, directory, filetype, paths, uponLoad, uponError, redirectedPaths);
				return true;
			} else
				return uponError ? uponError(redirectedPaths, message) : false;
		});
		return null;
	},
	load : function (paths, uponLoad, uponError) {
		paths = wrapArray(paths);
		var filetype = paths[0].match(/.*\.(\w+)/);
		if (filetype === null) {
			uponError(paths, "The supplied file (" + paths[0] + ") had no filtype.");
			return null;
		}
		switch (filetype[1]) {
			case "png":
				return Sprite.load(paths, uponLoad, uponError);
			case "mp3":
				return Sound.load(paths, uponLoad, uponError);
			default:
				uponError(paths, "The supplied file (" + paths[0] + ") had an unsupported filtype.");
				break;
		}
	}
};
Files = {};

Sprite = FunctionObject.new({
	canvases : [],
	load : function (paths, uponLoad, uponError) {
		return File.loadFileOfType("sprites", Image, "load", function (event, image, store, path) {
			var data = {
				animated : false,
				frames : 1
			};
			var fileData;
			if ((fileData = FileData.images).hasOwnProperty(path.replace(/~.*/, ""))) {
				data = JSONCopy(fileData[path.replace(/~.*/, "")]);
				if (data.hasOwnProperty("durations"))
					data.frames = data.durations.length;
			}
			data.image = image;
			data.cache = {};
			data.width = image.width / data.frames;
			data.height = image.height;
			return data;
		}, "images", "png", paths, uponLoad, uponError);
	},
	draw : function (canvas, path, x, y, aligned, filters, transformation, time) {
		var sprite = Sprite.load(path);
		if (sprite) {
			var image = sprite.image, positionModification = {
				x : 0,
				y : 0
			}, progress = (sprite.animated ? (arguments.length < 7 ? Time.now() : time) % sum(sprite.durations) : 0), frame = 0;
			if (sprite.animated) {
				while (progress > sprite.durations[frame])
					progress -= sprite.durations[frame ++];
			} else if (arguments.length >= 8) {
				if (time >= 0 && time < sprite.frames)
					frame = time;
				else
					return false;
			}
			if (aligned) {
				switch (canvas.getContext("2d").textAlign) {
					case "center":
						positionModification.x = - sprite.width / 2;
						break;
					case "right":
						positionModification.x = - sprite.width;
						break;
				}
				switch (canvas.getContext("2d").textBaseline) {
					case "middle":
						positionModification.y = - sprite.height / 2;
						break;
					case "bottom":
						positionModification.y = - sprite.height;
						break;
				}
			}
			positionModification.x -= View.position.x;
			positionModification.y -= View.position.y;
			Sprite.canvases[2].width = sprite.width;
			Sprite.canvases[2].height = sprite.height;
			if (sprite.animated && sprite.cache.hasOwnProperty(frame)) {
				Sprite.canvases[2].getContext("2d").drawImage(sprite.cache[frame], 0, 0);
			} else {
				Sprite.canvases[2].getContext("2d").drawImage(image, frame * sprite.width, 0, sprite.width, sprite.height, 0, 0, sprite.width, sprite.height);
				if (sprite.animated) {
					sprite.cache[frame] = document.createElement("canvas");
					sprite.cache[frame].width = sprite.width;
					sprite.cache[frame].height = sprite.height;
					sprite.cache[frame].getContext("2d").drawImage(Sprite.canvases[2], 0, 0);
				}
			}
			image = Sprite.canvases[2];
			if (filters) {
				filters = wrapArray(filters);
				foreach(filters, function (filter, number) {
					foreach(Sprite.canvases, function (temporaryCanvas, i) {
						if (i === 2)
							return;
						temporaryCanvas.width = sprite.width;
						temporaryCanvas.height = sprite.height;
					});
					if (!filter.hasOwnProperty("type")) {
						Sprite.canvases[0].getContext("2d").drawImage(image, 0, 0);
						var imageData = Sprite.canvases[0].getContext("2d").getImageData(0, 0, Sprite.canvases[0].width, Sprite.canvases[0].height), pixels = imageData.data;
						for (var i = 0, newPixel, excludeBlankPixels = true; i < pixels.length; i += 4) {
							if (pixels[i + 3] === 0 && excludeBlankPixels)
								continue;
							newPixel = filter(i % 4, pixels[i + 0], pixels[i + 1], pixels[i + 2], pixels[i + 3]);
							pixels[i + 0] = Math.floor(newPixel[0]);
							pixels[i + 1] = Math.floor(newPixel[1]);
							pixels[i + 2] = Math.floor(newPixel[2]);
							pixels[i + 3] = Math.floor(newPixel[3]);
						}
						Sprite.canvases[0].getContext("2d").clearRect(0, 0, Sprite.canvases[0].width, Sprite.canvases[0].height);
						Sprite.canvases[0].getContext("2d").putImageData(imageData, 0, 0);
					} else {
						switch (filter.type) {
							case "fill":
								Sprite.canvases[0].getContext("2d").fillStyle = filter.colour;
								Sprite.canvases[0].getContext("2d").fillRect(0, 0, Sprite.canvases[0].width, Sprite.canvases[0].height);
								Sprite.canvases[1].getContext("2d").fillStyle = "black";
								Sprite.canvases[1].getContext("2d").fillRect(0, 0, Sprite.canvases[1].width, Sprite.canvases[1].height);
								Sprite.canvases[1].getContext("2d").globalCompositeOperation = "destination-out";
								Sprite.canvases[1].getContext("2d").drawImage(image, 0, 0);
								Sprite.canvases[0].getContext("2d").globalCompositeOperation = "destination-out";
								Sprite.canvases[0].getContext("2d").drawImage(Sprite.canvases[1], 0, 0);
								Sprite.canvases[0].getContext("2d").globalCompositeOperation = "source-over";
								Sprite.canvases[1].getContext("2d").globalCompositeOperation = "source-over";
								break;
							case "crop":
								var width = Sprite.canvases[0].width, height = Sprite.canvases[0].height;
								if (filter.hasOwnProperty("width"))
									width = filter.width;
								else if (filter.hasOwnProperty("widthRatio"))
									width *= filter.widthRatio;
								if (filter.hasOwnProperty("height"))
									height = filter.height;
								else if (filter.hasOwnProperty("heightRatio"))
									height *= filter.heightRatio;
								if (width > 0 && height > 0)
									Sprite.canvases[0].getContext("2d").drawImage(image, 0, 0, width, height, 0, 0, width, height);
								positionModification.y += Sprite.canvases[0].height - height;
								break;
							case "opacity":
								Sprite.canvases[0].getContext("2d").globalAlpha = filter.value;
								Sprite.canvases[0].getContext("2d").drawImage(image, 0, 0);
								Sprite.canvases[0].getContext("2d").globalAlpha = 1;
								break;
						}
					}
					Sprite.canvases[2].getContext("2d").clearRect(0, 0, Sprite.canvases[2].width, Sprite.canvases[2].height);
					Sprite.canvases[2].getContext("2d").drawImage(Sprite.canvases[0], 0, 0);
					image = Sprite.canvases[2];
				});
			}
			if (transformation) {
				if (transformation[0])
					positionModification.x *= Math.abs(transformation[0]);
				if (transformation[3])
					positionModification.y *= Math.abs(transformation[3]);
				if (transformation[1] && aligned) {
					if (canvas.getContext("2d").textAlign === "right" && transformation[0] >= 0 || canvas.getContext("2d").textAlign === "left" && transformation[0] < 0)
						positionModification.y -= sprite.width * transformation[1];
					if (canvas.getContext("2d").textAlign === "center")
						positionModification.y -= sprite.width * transformation[1] * 0.5;
				}
				if (transformation[2] && aligned) {
					if (canvas.getContext("2d").textBaseline === "bottom" && transformation[3] >= 0 || canvas.getContext("2d").textBaseline === "top" && transformation[3] < 0)
						positionModification.x -= sprite.height * transformation[2];
					if (canvas.getContext("2d").textBaseline === "middle")
						positionModification.x -= sprite.height * transformation[2] * 0.5;
				}
				if (transformation[0] < 0)
					positionModification.x = sprite.width * Math.abs(transformation[0]) - positionModification.x;
				if (transformation[3] < 0)
					positionModification.y = sprite.height * Math.abs(transformation[3]) - positionModification.y;
			}
			x += positionModification.x;
			y += positionModification.y;
			x = Math.round(x);
			y = Math.round(y);
			if (transformation) {
				canvas.getContext("2d").save();
				canvas.getContext("2d").translate(x, y);
				canvas.getContext("2d").transform(transformation[0], transformation[1], transformation[2], transformation[3], transformation[4], transformation[5]);
				x = y = 0;
			}
			canvas.getContext("2d").drawImage(image, x, y);
			if (transformation) {
				canvas.getContext("2d").restore();
			}
			return true;
		}
		return false;
	}
}, {
	initialise : function () {
		for (var i = 0, canvas; i < 3; ++ i) {
			canvas = document.createElement("canvas");
			canvas.width = Settings._("screen dimensions => width");
			canvas.height = Settings._("screen dimensions => height");
			canvas.getContext("2d").imageSmoothingEnabled = false;
			Sprite.canvases.push(canvas);
		}
	}
});

Sound = {
	load : function (paths, uponLoad, uponError, playImmediately) {
		return File.loadFileOfType("sounds", Audio, "canplaythrough", function (event, sound, store, path) {
			var data = {
				sound : sound
			};
			if (playImmediately && Settings._("sound effects"))
				sound.play();
			return store[path] = data;
		}, "sounds", "mp3", paths, uponLoad, uponError);
	},
	play : function (paths, uponError) {
		if (Settings._("sound effects")) {
			var sound;
			if (sound = Sound.load(paths, uponLoad, uponError, true)) {
				sound.sound.currentTime = 0;
				sound.sound.play();
			}
		}
	}
};

Font = {
	load : function (size, weight, style, typeface) {
		if (!["px", "pt", "em", "rem"].contains(("" + size).substr(-2)))
			size += "px";
		return (style || "") + " " + (weight || Settings._("font").weight) + " " + size + " " + (typeface || Settings._("font").typeface);
	},
	loadFromStyle : function (style) {
		return Font.load(style.size, style.weight, style.style);
	}
};