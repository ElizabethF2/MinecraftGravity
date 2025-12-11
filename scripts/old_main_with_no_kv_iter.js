// Unused but included for benchmarking and experimentation

import { system, world } from '@minecraft/server';

const TICK_INTERVAL = 1;
const DEFAULT_RADIUS = 8;

globalThis.gravity_enabled = true;
globalThis.ordered_enqueued_passes = [];
globalThis.enqueued_passes_details = {};
globalThis.radius = DEFAULT_RADIUS;

const check_if_block_is_air_with_cache = function(bx, by, bz, bl, is_air_cache, block_type_cache, dimension)
{
  if (!(bl in is_air_cache))
  {
    var block = dimension.getBlock({x:bx, y:by, z:bz});
    if (block)
    {
      var is_air = block.isAir;
      is_air_cache[bl] = is_air;
      block_type_cache[bl] = block.type;
      return is_air;
    }
    else
    {
      is_air_cache[bl] = false;
      return false
    }
  }
  else
  {
    return is_air_cache[bl];
  }
}

const bottom_up_sort_func = function(a,b)
{
  const ay = a[1].y;
  const by = b[1].y;
  if (ay  < by)
  {
    return -1;
  }
  if (ay > by)
  {
    return 1;
  }
  return 0;
};

const do_gravity_pass_at_coords = function(dimension, location)
{
  var block_type_cache = [];
  var is_air_cache = [];
  var island_cache = [];
  var air_block_type = null;

  const px = location.x;
  const py = location.y;
  const pz = location.z;

  const radius = globalThis.radius;
  const eradius = radius+1
  const ediameter = 2*eradius;
  const ediameter2 = ediameter * ediameter;
  const grounded_island = ediameter2 * ediameter;

  for (var iy=-radius; iy<radius; ++iy)
  {
    try
    {
      for (var ix=-radius; ix<radius; ++ix)
      {
        for (var iz=-radius; iz<radius; ++iz)
        {
          var bx = (px + ix)|0;
          var by = (py + iy)|0;
          var bz = (pz + iz)|0;
          var bl = ((ix+eradius)*ediameter2) + ((iy+eradius)*ediameter) + (iz+eradius);
  
          var is_air = check_if_block_is_air_with_cache(bx, by, bz, bl, is_air_cache, block_type_cache, dimension);
          
          if (!is_air)
          {
             if ((iy == -radius) || (iy == radius) || (ix == -radius) || (ix == radius) || (iz == -radius) || (iz == radius))
             {
               island_cache[bl] = grounded_island;
             }
             else
             {
               var neighbor_blocks = [
                 [bx, by-1, bz, bl-ediameter],
                 [bx-1, by, bz, bl-ediameter2],
                 [bx+1, by, bz, bl+ediameter2],
                 [bx, by, bz-1, bl-1],
                 [bx, by, bz+1, bl+1],
                 [bx, by+1, bz, bl+ediameter]
               ];

               var island_id = bl;
               for (var [nbx, nby, nbz, nbl] of neighbor_blocks)
               {
                 var neighbor_is_air = check_if_block_is_air_with_cache(nbx, nby, nbz, nbl, is_air_cache, block_type_cache, dimension);
                 if ((!neighbor_is_air) && (nbl in island_cache))
                 {
                   island_id = island_cache[nbl];
                 }
               }
               if (island_id != grounded_island)
               {
                 for (var [nbx, nby, nbz, nbl] of neighbor_blocks)
                 {
                   if (island_cache[nbl] == grounded_island)
                   {
                     island_id = grounded_island;
                     break;
                   }
                 }
               }
               for (var [nbx, nby, nbz, nbl] of neighbor_blocks)
               {
                 var neighbor_is_air = check_if_block_is_air_with_cache(nbx, nby, nbz, nbl, is_air_cache, block_type_cache, dimension);
                 if (!neighbor_is_air)
                 {
                   island_cache[nbl] = island_id;
                 }
               }
               island_cache[bl] = island_id;
             }
          }
          else if (!air_block_type)
          {
            air_block_type = block_type_cache[bl];
          }
        }
      }
    }
    catch(e)
    {
      // Handle out of bounds blocks
      for (var ix=-radius; ix<radius; ++ix)
      {
        for (var iz=-radius; iz<radius; ++iz)
        {
          var bx = (px + ix)|0;
          var by = (py + iy)|0;
          var bz = (pz + iz)|0;
          var bl = ((ix+eradius)*ediameter2) + ((iy+eradius)*ediameter) + (iz+eradius);
          is_air_cache[bl] = false;
          island_cache[bl] = grounded_island;
        }
      }
    }
  }

  if (air_block_type)
  {
    var island_id_to_blocks = [];
    for (var iy=-radius; iy<radius; ++iy)
    {
      for (var ix=-radius; ix<radius; ++ix)
      {
        for (var iz=-radius; iz<radius; ++iz)
        {
          const bl = ((ix+eradius)*ediameter2) + ((iy+eradius)*ediameter) + (iz+eradius);
          const island_id = island_cache[bl];
          if (island_id !== undefined && island_id != grounded_island)
          {
            const bv = {x:(px+ix)|0, y:(py+iy)|0, z:(pz+iz)|0};
            var blocks = island_id_to_blocks[island_id];
            if (blocks)
            {
              blocks.push([bl, bv])
            }
            else
            {
              island_id_to_blocks[island_id] = [[bl, bv]];
            }
          }
        }
      }
    }

    var blocks_moved = false;
    for (var island_id=0; island_id < grounded_island; ++island_id)
    {
      const blocks = island_id_to_blocks[island_id];
      if (blocks)
      {
        const blocks_bottom_up = blocks.sort(bottom_up_sort_func);
        for (const [bl, bv] of blocks_bottom_up)
        {
          const block_below = {x:bv.x, y:bv.y-1, z:bv.z};
          const block_above_label = bl + ediameter;
          var block_type = block_type_cache[bl];
          if (block_type)
          {
            dimension.fillBlocks(block_below, block_below, block_type, null);
            blocks_moved = true;
            if (island_cache[block_above_label] != island_id)
            {
              dimension.fillBlocks(bv, bv, air_block_type, null);
            }
          }
        }
      }
    }

    if (blocks_moved)
    {
      const bx = location.x;
      const by = location.y-1;
      const bz = location.z;
      const bl = bx+','+by+','+bz;
      if (!(bl in globalThis.enqueued_passes_details))
      {
        globalThis.enqueued_passes_details[bl] = [dimension, {x: bx, y:by, z:bz}];
        globalThis.ordered_enqueued_passes.push(bl);
      }
    }

    // -=[[PSEUDO-CODE DRAFT FOR REFERENCE ]]=-
    //
    // for block in radius bottom up:
    //   cache if block is air
    //   if not air:
    //     island_id = undefined
    //     if block at low height limit or at edge of radius:
    //       island_id = grounded
    //     else:
    //       for nblock in neighboring blocks bottom up:
    //         cache if nblock is air
    //         if not air and nblock in island_cache:
    //           island_id = island_cache[nblock]
    //       if island_cache === undefined:
    //         island_id = block
    //       for nblock in neighboring blocks:
    //         island_cache[nblock] = island_id
    //      island_cache[block] = island_id
    //
    // build island_id_to_blocks, ignore ground
    // sort blocks in island_id_to_blocks bottom up
    //
    // for island in island_id_to_blocks:
    //   for block in island:
    //     set block below to same type as block
    //     if block above not in island, set block to air
  }
}

world.afterEvents.chatSend.subscribe(function(evt)
{
  const sp = evt.message.split(' ');
  if (evt.message == '!grav')
  {
    if (evt.sender.isOp())
    {
      globalThis.gravity_enabled = !globalThis.gravity_enabled;
      world.sendMessage('Gravity is now ' + (globalThis.gravity_enabled ? 'enabled' : 'disabled'));
    }
  }
  else if (sp[0] == '!gravr')
  {
    if (evt.sender.isOp())
    {
      var new_radius = (sp[1]|0) || DEFAULT_RADIUS;
      globalThis.radius = new_radius;
      world.sendMessage('Gravity pass radius is now ' + new_radius);
    }
  }
  else if (evt.message == '!gravq')
  {
    world.sendMessage('Gravity pass queue length is ' + globalThis.ordered_enqueued_passes.length);
  }
});

const enque_block_event_coords_for_pass_if_not_already_in_queue = function(evt)
{
  const new_location = evt.block.location;
  const bl = new_location.x+','+new_location.y+','+new_location.z;
  if (!(bl in globalThis.enqueued_passes_details))
  {
    globalThis.enqueued_passes_details[bl] = [evt.dimension, new_location];
    globalThis.ordered_enqueued_passes.push(bl);    
  }
}

world.afterEvents.playerBreakBlock.subscribe(enque_block_event_coords_for_pass_if_not_already_in_queue);

world.afterEvents.blockExplode.subscribe(enque_block_event_coords_for_pass_if_not_already_in_queue);

system.runInterval(() => {
  if (!globalThis.gravity_enabled)
  {
    return;
  }
  
  if (globalThis.ordered_enqueued_passes.length > 0)
  {
    const bl = globalThis.ordered_enqueued_passes.pop();
    const [dimension, location] = globalThis.enqueued_passes_details[bl];
    delete globalThis.enqueued_passes_details[bl];
    do_gravity_pass_at_coords(dimension, location);
  }
}, TICK_INTERVAL);
