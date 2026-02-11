# JS Tanks - Coding Challenge (README)


## Creating a Tank

- Decide a name for your tank (tankname).
- Open `/tanks/tankslist.js` in a text editor, and add your tanks name to the `tankList` array.
- Create a JavaScript (.js) file in the `/tanks` directory with the same name as your tank (TankName.js).
- Implement your tanks logic in the `main` function of the JavaScript file you created.
- The `main` function accepts `tank` and `arena` objects as arguments and must return the modified `tank` object.
- Avoid writing code outside of the `main` function to prevent global scope issues. Use `tank.retained` for persistent data. `tank.retained` is cleared between matches.
- See `/tanks/_Example.js` for help.
- NOTE: Starting your tank name with an underscore (`_`) will make it appear at the bottom of the tank selection list, not be included in tournaments, and never be selected as one of the default tanks.


## Energy Usage

- Colliding with a wall results in energy loss determined by your `actualSpeed` and the angle of impact.
- Colliding with another tank results in energy loss determined by the combined `actualSpeed` of both tanks and the angle of impact.
- Moving consumes energy at a rate of `Math.abs(tank.speed) * MOVEMENT_COST_MULTIPLIER` units per iteration.
- Calling `tank.fire(energy)` will deduct the specified energy from your tank. The missile fired will start with an energy level that is `MISSILE_ENERGY_MULTIPLIER` times the deducted amount.
- If your tank is struck by a missile, the amount of energy you lose is equivalent to the energy the missile had left at the moment of impact.



## Game Interaction and Fair Play

Your tank's code must only interact with the game via the `tank` and `arena` objects passed as arguments
to your `main` function. These objects are your sole interfaces for sensing the game and controlling your
tank. Directly accessing or modifying any other game elements, variables, or functions outside of these `tank` and `arena` objects
is considered cheating. It violates the intended game mechanics, creates an unfair advantage, and undermines the integrity of
the challenge. For fair play, limit your code's interaction exclusively to the properties of the input tank and arena objects.



## Game Constants

| Constant Name                    | Data Type    | Description
| -------------------------------- | ------------ | -------------------------------------------------------------------------------------------------------
| `ARENA_HEIGHT`                   | Number       | The height of the arena (same as `arena.height`).
| `ARENA_WIDTH`                    | Number       | The width of the arena (same as `arena.width`).
| `MAX_DISTANCE`                   | Number       | The maximum possible distance in the arena (corner to corner).
| `MIN_X`                          | Number       | The minimum possible x-coordinate (equal to `-ARENA_WIDTH / 2`).
| `MAX_X`                          | Number       | The maximum possible x-coordinate (equal to `ARENA_WIDTH / 2`).
| `MIN_Y`                          | Number       | The minimum possible y-coordinate (equal to `-ARENA_HEIGHT / 2`).
| `MAX_Y`                          | Number       | The maximum possible y-coordinate (equal to `ARENA_HEIGHT / 2`).
| `TANK_SIZE`                      | Number       | The size of your tank (radius).
| `MAX_TANK_ENERGY`                | Number       | The maximum possible energy for tanks.
| `TANK_ACCELERATION`              | Number       | The rate at which tanks accelerate.
| `MAX_ACTUAL_SPEED`               | Number       | The maximum actual speed for tanks.
| `MAX_BODY_TURN_DEGREES`          | Number       | The maximum amount of body turning rotation per iteration (degrees).
| `MAX_GUN_TURN_DEGREES`           | Number       | The maximum amount of gun turning rotation per iteration (degrees).
| `MAX_RADAR_TURN_DEGREES`         | Number       | The maximum amount of radar turning rotation per iteration (degrees).
| `MAX_RADAR_ARC_DEGREES`          | Number       | The maximum width of the radars arc (degrees).
| `MAX_COLLISION_DAMAGE`           | Number       | The maximum amount of damage that can be caused by a collision with a tank or wall.
| `MAX_MISSILE_ENERGY`             | Number       | The maximum possible energy for missiles.
| `MISSILE_FLIGHT_COST`            | Number       | The amount of energy it cost for a missile to move per iteration.
| `MISSILE_SPEED`                  | Number       | The speed at which missiles travel.
| `MISSILE_MIN_SIZE`               | Number       | The minimum size for missiles.
| `MISSILE_MAX_SIZE`               | Number       | The maximum size for missiles (equal to `TANK_SIZE / 10`).
| `PI`                             | Number       | Equal to `Math.PI` (3.141592653589793).
| `EPSILON`                        | Number       | The mallest possible difference between 1 and the next representable number (equal to `Number.EPSILON`).
| `DEGREES`                        | Number       | The conversion factor for converting radians to degrees (equal to `180 / Math.PI`).
| `RADIANS`                        | Number       | The conversion factor for converting degrees to radians (equal to `Math.PI / 180`).
| `MAX_MATCHES`                    | Number       | The maximum number of matches a game can run for.
| `MAX_ITERATIONS`                 | Number       | The maximum number of iterations a match can run for.
| `DAMAGE_DEALT_POINTS`            | Number       | The amount of points awarded for for damage your tank deals to other tanks (this amount is multiplied by the damage dealt at every shot).
| `SURVIVAL_BONUS_POINTS`          | Number       | The amount of bonus points awarded to the winner of the match for survival (this amount is multiplied by the winner's remaining energy at the end of the match).
| `ACCURACY_BONUS_POINTS`          | Number       | The amount of bonus points awarded to the winner of the match for accuracy (this amount is multiplied by the winner's accuracy percentage at the end of the match).
| `MOVEMENT_COST_MULTIPLIER`       | Number       | The multiplier for the energy cost of movement.
| `TANK_SPEED_BONUS_POINTS`        | Number       | The amount of points awarded for for absolute speed of your tank (this amount is multiplied by the absolute value of the speed of your tank during every iteration).
| `MISSILE_ENERGY_MULTIPLIER`      | Number       | The multiplier for missile energy.
| `GUN_HEAT_MULTIPLIER`            | Number       | The multiplier for `gunHeat` for tanks.
| `MAX_GUN_HEAT`                   | Number       | The maximum possible `gunHeat` for tanks.
| `SPAWN_POWERUP_PROBABILITY`      | Number       | The probability of a powerup spawning on any given iteration.
| `MIN_POWERUP_AMOUNT`             | Number       | The minimum amount for powerups.
| `MAX_POWERUP_AMOUNT`             | Number       | The maximum amount for powerups.
| `POWERUP_PICKUP_DURATION`        | Number       | The duration in intervals powerups remain on the screen.


## Read-Only Properties

| Property Name                    | Data Type    | Description
| -------------------------------- | ------------ | --------------------------------------------------------------------------------------------------------
| `arena.height`                   | Number       | The height of the arena. (same as `ARENA_HEIGHT`)
| `arena.width`                    | Number       | The width of the arena. (same as `ARENA.WIDTH`)
| `arena.tanksRemaining`           | Number       | The number of tanks still active in the match.
| `arena.gameCount`                | Number       | The current match number.
| `arena.gameSpeed`                | Number       | The currently selected game speed specified in game settings
| `arena.animate`                  | Boolean      | `true` if animations are enabled in game settings, false otherwise.
| `arena.sound`                    | Boolean      | `true` if sound is enabled in game settings, false otherwise.
| `arena.missileInterception`      | Boolean      | `true` if game settings allow intercepting missiles, `false` otherwise. Colliding missiles reduce energy on a 1:1 basis. Any missile reduced to zero energy is removed from the arena (The missile the with most energy survives the collision). 
| `arena.powerupsSpawned`          | Number       | The total number of powerups spawned in the arena during this match.
| `tank.name`                      | String       | The name of your tank (tank file name).
| `tank.index`                     | Number       | Your tank's unique identifier in the current match.
| `tank.state`                     | String       | The current status of your tank.
| `tank.size`                      | Number       | The physical size (radius) of your tank.
| `tank.wins`                      | Number       | The current number of matches your tank has won.
| `tank.losses`                    | Number       | The current number of matches your tank has lost.
| `tank.score`                     | Number       | The current score of your tank.
| `tank.iteration`                 | Number       | The current game tick or iteration number of the match.
| `tank.energy`                    | Number       | The amount of energy your tank has remaining.
| `tank.x`                         | Number       | Your tank's current x-coordinate in the arena.
| `tank.y`                         | Number       | Your tank's current y-coordinate in the arena.
| `tank.aimAccuracy`               | Number       | Your tank's calculated accuracy (hits / shots).
| `tank.actualSpeed`               | Number       | The current actual speed of your tank (equal to  `tank.speed * MAX_ACTUAL_SPEED`).
| `tank.bodyAim`                   | Number       | The current angle of your tank's body. (degrees, absolute)
| `tank.gunAim`                    | Number       | The current angle of your turret relative to your tank's body (degrees, relative).
| `tank.gunHeat`                   | Number       | The current heat level of your gun (cannot fire if `tank.gunHeat > 0`). 
| `tank.radarAim`                  | Number       | The current angle of your radar relative to your tank's body and gun (degrees, relative).
| `tank.powerupCollected`          | Boolean      | True if a power up was collected this iteration.
| `tank.powerupsCollected`         | Number       | The current number of powerups your tank has collected during this match.
| `tank.powerup`                   | Object/False | Data about your tanks current powerup.
|    - `type`                      | String       | The type of powerup you currently have
|    - `amount`                    | Number       | The amount of the powerup you currently have
| `tank.tankCollision`             | Object/False | Data about a collision with another tank, or `false` if no collision.
|    - `id`                        | Number       | The `id` of the tank you collided with.
|    - `angle`                     | Number       | The angle to the collision (absolute, in degrees).
|    - `damage`                    | Number       | The amount of damage sustained in the collision.
| `tank.missileCollision`          | Object/False | Data about a collision with a missile, or `false` if no collision.
|    - `ownerId`                   | Number       | The `id` of the tank that fired the missile you collided with.
|    - `angle`                     | Number       | The angle to the collision.
|    - `damage`                    | Number       | The amount of damage sustained in the collision.
| `tank.wallCollision`             | Object/False | Data about a collision with a wall, or `false` if no collision.
|    - `angle`                     | Number       | The angle to the collision.
|    - `damage`                    | Number       | The amount of damage sustained in the collision.
| `tank.missiles[id]`              | Object/False | Data about the missile you fired with the given `id`.
|    - `iterationFired`            | Number       | The `tank.iteration` when the missile was fired.
|    - `x`                         | Number       | The current x-coordinate of the specified missile in the arena.
|    - `y`                         | Number       | The current y-coordinate of the specified missile in the arena.
|    - `aim`                       | Number       | The angle the specified missile is heading (in degrees, absolute).
|    - `energy`                    | Number       | The amount of energy the specified missile has remaining.
|    - `size`                      | Number       | The physical size (radius) of the specified missile.
|    - `miss`                      | Boolean      | `true` if the specified missile has hit a wall or ran out of energy, `false` otherwise.
|    - `hit`                       | Boolean      | `true` if the specified missile has hit a tank, `false` otherwise.
| `tank.detectedTanks[index]`      | Array        | Data about a tank detected by your radar at the given `index` (sorted by distance).
|    - `index`                     | Number       | The index of the detected tank.
|    - `file`                      | String       | The file name of the detected tank.
|    - `name`                      | String       | The name of the detected tank.
|    - `energy`                    | Number       | The amount of energy the detected tank has remaining.
|    - `gunHeat`                   | Number       | The current heat level of the detected tank's gun.
|    - `size`                      | Number       | The physical size (radius) of the detected tank.
|    - `color`                     | String       | The outline color of the detected tank's body (hexadecimal).
|    - `fillColor`                 | String       | The fill color of the detected tank's body (hexadecimal).
|    - `gunColor`                  | String       | The color of the detected tank's gun (hexadecimal).
|    - `radarColor`                | String       | The color of the detected tank's radar (hexadecimal).
|    - `treadColor`                | String       | The color of the detected tank's treads (hexadecimal).
|    - `angleTo`                   | Number       | The angle (in degrees) from your tank to the detected tank.
|    - `distance`                  | Number       | The distance between your tank and the detected tank.
|    - `x`                         | Number       | The current x-coordinate of the detected tank in the arena.
|    - `y`                         | Number       | The current y-coordinate of the detected tank in the arena.
|    - `bodyAim`                   | Number       | The current angle of the detected tank's body (in degrees, absolute).
|    - `speed`                     | Number       | The speed controller for the detected tank (-1 to 1).
|    - `actualSpeed`               | Number       | The actual speed of the detected tank (`speed * MAX_ACTUAL_SPEED`).
| `tank.detectedMissiles[index]`   | Array        | Data about a missile detected by your radar at the given `index` (sorted by distance).
|    - `energy`                    | Number       | The remaining energy of the detected missile.
|    - `size`                      | Number       | The physical size (radius) of the detected missile.
|    - `angleTo`                   | Number       | The angle (in degrees) from your tank to the detected missile.
|    - `distance`                  | Number       | The distance between your tank and the detected missile.
|    - `x`                         | Number       | The current x-coordinate of the detected missile in the arena.
|    - `y`                         | Number       | The current y-coordinate of the detected missile in the arena.
|    - `aim`                       | Number       | The current aim angle of the detected missile (in degrees, absolute).
|    - `speed`                     | Number       | The speed controller for the detected missile (normalized, will always be `1`).
|    - `actualSpeed`               | Number       | The actual speed of the detected missile (will always be `MISSILE_SPEED`).
|    - `id`                        | Number       | The id of the detected missile.
|    - `ownerIndex`                | Number       | The index of the tank that fired the detected missile.
| `tank.detectedPowerups[index]`   | Array        | Data about a powerup detected by your radar at the given `index` (sorted by distance).
|    - `type`                      | String       | The type of powerup.
|    - `amount`                    | Number       | The amount of this powerup.
|    - `angleTo`                   | Number       | The angle (in degrees) from your tank to the detected powerup.
|    - `distance`                  | Number       | The distance between your tank and the detected powerup.
|    - `duration`                  | Number       | The duration in intervals until this powerup disappears from the screen.
|    - `x`                         | Number       | The current x-coordinate of the detected powerup in the arena.
|    - `y`                         | Number       | The current y-coordinate of the detected powerup in the arena.



## Controllable Properties

| Property Name                    | Data Type    | Acceptable Value       | Default Value | Description
| -------------------------------- | ------------ | ---------------------- | ------------- | -----------------------------------------------------------------------------------------------------------------------------------------------------
| `tank.debug`                     | Object       | Canvas 2D Methods      | `ctx` Proxy   | A drawing context for debugging purposes. Coordinates are auto-centered (0,0 is the arena middle). Ignores all calls if debugging is disabled in the UI. 
| `tank.message`                   | String       | Max Length: 64         | ""            | A message to be displayed above your tank during the match.
| `tank.victoryMessage`            | String       | Max Length: 64         | "Winner"      | A message displayed above your tank when it wins.
| `tank.color`                     | String       | Hexadecimal Code       | "#000000"     | The outline color of your tank's body.
| `tank.fillColor`                 | String       | Hexadecimal Code       | "#FFFFFF"     | The fill color of your tank's body.
| `tank.treadColor`                | String       | Hexadecimal Code       | "#808080"     | The color of your tank's treads.
| `tank.gunColor`                  | String       | Hexadecimal Code       | "#404040"     | The color of your tank's gun.
| `tank.radarColor`                | String       | Hexadecimal Code       | "#00FFFF"     | The color of your tank's radar.
| `tank.speed`                     | Number       | -1 to 1                | 0             | The desired speed of your tank, where `-1` is full reverse, `0` is stop, and `1` is full forward. The actual speed is determined by `tank.speed * MAX_ACTUAL_SPEED`.
| `tank.bodyTurn`                  | Number       | -1 to 1                | 0             | How much to turn the tank's body per iteration (`-1` = `MAX_BODY_TURN_DEGREES` left, `0` no turn, `1` = `MAX_BODY_TURN_DEGREES` right).
| `tank.gunTurn`                   | Number       | -1 to 1                | 0             | How much to turn the tank's turret relative to the body per iteration (`-1` = `MAX_GUN_TURN_DEGREES` left, `0` no turn, `1` = `MAX_GUN_TURN_DEGREES` right).
| `tank.radarTurn`                 | Number       | -1 to 1                | 0             | How much to turn the radar relative to the body and gun per iteration (`-1` = `MAX_RADAR_TURN_DEGREES` left, `0` no turn, `1` = `MAX_RADAR_TURN_DEGREES` right).
| `tank.radarArc`                  | Number       | 0 to 1                 | 1             | The width of your radar's scanning arc (`0` = 0 degrees, `1` = `MAX_RADAR_ARC_DEGREES` degrees, the radar is centered on the `radarAim`, and the tank detects everything inside of the `radarArc` instantly).
| `tank.handicap`                  | Number       | 0 to 1                 | 0             | An optional handicap (`0` full damage, `0.5` half damage, `1` no damage). Higher values reduce damage dealt to targets.
| `tank.retained`                  | JSON Object  | Any Valid JSON         | {}            | An empty JSON object for storing persistent data across iterations.
| `tank.indicator`                 | Object       | Expected Properties    | {}            | An object containing the color and intensity values for your tanks indicator light.
|    - `color`                     | String       | Hexadecimal Code       | "#00FF00"     | The color of your tanks indicator light
|    - `intensity`                 | Number       | 0 to 1                 | 0             | The intensity (brightness) of your tanks indicator light



## Tank Methods

| Method Name                      | Returns      | Description
| -------------------------------- | ------------ | -------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------
| `tank.angleTo(x, y)`             | Number       | Returns the angle from your tank to the specified `x` and `y` coordinates.
| `tank.angleFrom(x, y)`           | Number       | Returns the angle the specified `x` and `y` coordinates to your tank.
| `tank.distanceTo(x, y)`          | Number       | Returns the distance from your tank to the specified `x` and `y` coordinates.
| `tank.fire(energy)`              | Number       | Fires a missile with the specified `energy` multiplied times `MISSILE_ENERGY_MULTIPLIER`. The missile energy is limited `MAX_MISSILE_ENERGY`. Can not fire if `tank.gunHeat > 0` Returns `id` of fired missile (used as an index for `tank.missiles`). Missiles lose `MISSILE_FLIGHT_COST` units of energy per iteration.

## Arena Methods

| Method Name                      | Returns      | Description
| -------------------------------- | ------------ | -------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------
| `arena.nearestWallAngle(x, y)`   | Number       | Returns the angle to the nearest wall (degrees, absolute)
| `arena.nearestWallDistance(x, y)`| Number       | Returns the distance to the nearest wall
| `arena.contains(x, y, margin)`   | Boolean      | `true` if the specified point is within the margins of the arena, `false` otherwise.


## Powerups

| Powerup Name    | Icon           | Returns      | Description
| -------------------------------- | ------------ | -------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------
| `armor`         | 🛡️             | N/A          | Reduces damage taken by missiles and collisions by 50%.
| `energy`        | 🔋             | N/A          | Increases your tank's energy by the specified amount. 
| `speed`         | ⚡️             | N/A          | Doubles the number of iterations your tank gets per frame.
| `guncool`       | ❄️             | N/A          | Decreases gunheat by half and doubles the guns rate of cooling. 
| `firepower`     | 🔥             | N/A          | Doubles the energy of missiles fired by your tank (energy becomes `energy * 2 * MISSILE_ENERGY_MULTIPLIER`). 
| `airstrike`     | ✈             | N/A          | Calls in a support aircraft to fly over the arena and fire missiles at the enemy tank.


## Math Functions (some common functions)
| Function Name                    | Returns      | Description
| -------------------------------- | ------------ | -------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------
| `clamp(number, min, max)`        | Number       | Restricts the range of `number` from `min` to `max`.
| `lerp(a, b, lerpFactor)`         | Number       | Performs a linear interpolation from `a` to `b`.
| `getAngle(x1, y1, x2, y2)`       | Number       | Returns the angle (in degrees) to between two specified points
| `getDistance(x1, y1, x2, y2)`    | Number       | Returns the distance to between two specified points
| `normalizeAngle(angle)`          | Number       | Returns the angle (in degrees) normalized from -180 degrees to 180 degrees.
| `dotProduct2D(x1, y1, x2, y2)`   | Number       | Returns the dot product of the specified vectors.

## URL Parameters
| URL Parameter                    | Data Type    | Description
| -------------------------------- | ------------ | -------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------
| `a`                              | String       | The file name for the default tank A (case sensitive, omit the .js).
| `b`                              | String       | The file name for the default tank B (case sensitive, omit the .js).
| `matches`                        | Number       | The maximum number of matches to allow this game to run.
| `pspawn`                         | Number       | The probability of spawning a pickup on any iteration (`0` to `1`, default is `0.002`)
| `start`                          | N/A          | If included the game will automatically start with the default tanks.
| `headless`                       | N/A          | If included animations will be disabled be default.
| `tournament`                     | N/A          | If included the game will run a round robin tournament (not including tanks who's name begin with an underscore).


## Change Log

- Added `MAX_MATCHES` constant to reload page after specified number of matches.
- Added URL parameters for tank selection, max matches, and headless mode.
- Added muzzel flash when tanks fire.
- Added smoke and sparks particle effect for damaged tanks.
- Added tank debris particle effect, and screen flash for exploding tanks.
- Changed `tank.name` so that it is a read only value (the file name of the bot).
- Added `tank.powerupCollected` boolean (true if a power up was collected during this iteration).
- Added URL parameters for powerup spawn rate, auto-start, and tournament mode.
- Added `armor` and `airstrike` powerups.
- Added sounds for tank's, airplanes, and powerup collection.
- Changed `sounds.js` to use a library of cached sounds, instead of creating a new one every time.
