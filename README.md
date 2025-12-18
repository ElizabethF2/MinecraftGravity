# Minecraft Gravity

Gravity is a mod for the PC and mobile versions of Minecraft: Bedrock Edition which improves realism by causing all blocks left floating to fall. It's designed to interoperate with other mods (e.g. using a rocket launcher mod with Gravity will cause the debris left from the rocket to fall rather than remain floating) and can be used with any other feature of Bedrock including all DLC and RTX lighting. Gravity is a server-side mod which supports multiplayer and only needs to be installed by the host. It may be possible to use it on consoles by hosting the server and mod on a supported device though this is untested.


## Installation

Download the latest version of the mod by selecting the "Gravity.mcpack" link from the [releases](https://github.com/ElizabethF2/MinecraftGravity/releases/latest) page and open the downloaded file from your browser's downloads page or by using your device's file browser. If prompted, select Minecraft as the application to use to open the file. Minecraft should automatically import the mod.

Create a new world or edit an existing world and add the mod to the world under Add-Ons > Behavior Packs.

You must enable "Beta APIs" under Experiments or the mod will not run. This requirement should be removed in future versions of the mod once the API this mod uses is out of beta on Minecraft.

The mod can be uninstalled by going to Settings > General > Storage > Behavior Packs in Minecraft, selecting "Gravity" from the list and then selecting the delete (trash can) icon.


## Usage

Gravity should be automatically enabled with default settings as soon as you load into the world. You can test it by building a two block tall tower; when you destroy the bottom block, the top one will fall. Gravity monitors chat for commands which can be used to toggle it on and off, check its status and change settings. Note that settings do not persist after exiting the world in single player or after restarting the server in multiplayer. See the "Advanced Usage" section for details on how to permanently change settings. The available commands are listed below.

`!grav`
This command toggles gravity on and off. This can be used to improve performance if the mod is causing too much lag. Gravity works by keeping a queue of blocks which have been broken and by performing "gravity passes" on them to check if they are floating. See the "Technical Details" section for details on how the mod works. While the mod if toggled off, blocks will still be added to the queue so it's possible to "freeze time" by toggling the mod off, break or blow up several blocks then enable the mod to "resume time" and watch all of the blocks fall. The queue is lost when exiting the game on single player or stopping the server in multiplayer so blocks still in the queue when the game is stopped with remain floating until a block near them is broken again. This command can only be used by players with Operator permissions and will be ignored if used by other players.

`!gravq`
This command is used to check how big the queue currently is. It sends a message to all players in chat that tells them the current number of pending passes remaining in the queue. It can be used by all players.

`!gravr`
This command changes the "radius" around a broken block that is checked during a pass. For example, to set the radius to 5 blocks, use `!gravr 5`. To set the radius back to the default, use the command without a number: `!gravr`. Any blocks outside of the volume defined by the radius are not checked and are assumed to be connected to the ground. As such, floating groups of blocks larger than this volume will not be affected by gravity. If Minecraft is lagging, reducing the radius can improve performance. Lower radii make gravity run faster but can leave larger groups of blocks floating, while higher radii are more accurate an and cause larger groups of blocks to fall at the expense of running slower. Note that, despite the term "radius" being used, the volume checked during a pass is a cube, not a sphere. Performance worsens exponentially as the radius increases; a radius of 3 performs 27 times worse than a radius of 1 rather than 3 times worse (3x3x3 vs 1x1x1). This command can only be used by players with Operator permissions and will be ignored if used by other players.

`!grava`
This command changes the "alignment factor" used by the mod's queue. As with radius, use it with a number to set the factor (e.g. `!grava 2` to set it to 2) or without a number to reset back to the default value: `!grava`. This value can be increased to improve performance. Higher values perform better but can leave some blocks floating while lower values cause blocks to fall more consistently at the expense of performance. It essentially controls how often blocks are "skipped" for passes. See the "Technical Details" section for more information. As with the radius, performance scale exponentially but the ratio inverted e.g. a factor of 3 runs 27 times **better** than a factor of 1. This command can only be used by players with Operator permissions and will be ignored if used by other players.


## Troubleshooting

Try these steps if you encounter any issues:

  - Ensure Minecraft: Bedrock Edition has been updated to the latest version
  - Turn on logging before loading your world (Settings > Creator > Enable Content Log GUI), load your world then check the log for errors (Settings > Creator > Content Log History). Please include a copy of any errors if you're opening an issue.
  - If blocks aren't falling, use `!gravq` to check the queue size to ensure the blocks aren't just waiting in the queue.
  - If the queue size isn't decreasing over time, ensure the mod is enabled via `!grav`
  - The queue handles passes from most recently broken block to least recently broken block. If you're trying to get a specific block or group of blocks to fall and you don't want to wait, you can break a block near them to "jump the queue" and add a pass that will be handled immediately. Note that doing this will just delay the other passes that are already pending.


## Advanced Usage

You can permanently change the mod's settings by editing it to change the default values it uses. To do so, follow these steps:

  1. Uninstall the mod if you've already installed it
  2. Download the mod and navigate to where you downloaded it in your file browser
  3. Change your file browser's settings so that it displays extensions. The package for the mod should be listed as `Gravity.mcpack` rather than just `Gravity`
  4. Rename the mod from `Gravity.mcpack` to `Gravity.zip`
  5. Open or extract the .zip file
  6. In the `scripts` folder open `main.js` in a text editor
  7. The default values are defined near the top. `DEFAULT_RADIUS` defines the radius, `DEFAULT_ALIGNMENT_FACTOR` defines the alignment factor and `gravity_enabled` controls whether the mod starts enabled or disabled. Change only these settings to whichever values you want and leave everything else unchanged i.e. don't delete any of the semi-colons or otherwise change the file.
  8. If you extracted the zip file, delete the original `Gravity.zip` and re-compress your modified files into a new `Gravity.zip`
  9. Rename `Gravity.zip` back to `Gravity.mcpack` and install the mod like normal as described int the "Installation" section


## Technical Details

This section provides a high level overview of how the mod works. As mentioned in the "Usage" section, whenever a block is broken or blown up, its coordinates are captured by the mod. These coordinates are reduced until they are a multiple of the alignment factor. For example, with a factor of 3, coordinates at 0 and 3 would remain unchanged but 1 and 2 would be reduced to 0 and 4 and 5 would be reduced to 3. Coordinates are not added to the queue if they are already in the queue so the alignment factor reduces the number of passes that are enqueued and ensures that the passes that are enqueued are handled more quickly. At regular intervals, while the mod is enabled, coordinates are taken from the queue. The queue is a LIFO queue (last in first out) so the most recent coordinates are handled first. For each coordinate, a "gravity pass" is done.

During the pass, blocks that are connected together are grouped into "islands". Any block touching the ground is considered "grounded" and any block touching a grounded block is also considered grounded. Using these rules, all blocks that aren't floating are grouped together as the "grounded island". The radius is used to define a cube around the coordinate. The pass iterates through all blocks in the cube. Blocks at any of the six edges of the cube are assumed to be part of the grounded island since the pass can't check outside of the radius. The pass looks for any un-grounded (i.e. floating ) islands and sorts them from lowest height to highest. If any floating islands are found, it moves each of them one block down, staring from lowest to highest, and enqueues another pass one block down from the original coordinates. This ensures that the floating islands continue to fall until they read the ground at which point they become part of the grounded island and there are no more floating islands within the volume of that pass.

