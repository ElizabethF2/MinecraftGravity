import { system, world, BlockVolume } from '@minecraft/server';

const TICK_INTERVAL = 1;
const DEFAULT_RADIUS = 8;
const DEFAULT_ALIGNMENT_FACTOR = 3;
const GROUNDED_ISLAND = 'G';

globalThis.gravity_enabled = true;
globalThis.ordered_enqueued_passes = [];
globalThis.enqueued_passes_details = {};
globalThis.radius = DEFAULT_RADIUS;
globalThis.alignment_factor = DEFAULT_ALIGNMENT_FACTOR;

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
  const radius = globalThis.radius;
  const eradius = radius+1
  const ediameter = 2*eradius;
  const ediameter2 = ediameter * ediameter;
  const ediameter3 = ediameter2 * ediameter;

  var block_type_cache = [];
  block_type_cache.length = ediameter3;
  var is_air_cache = [];
  is_air_cache.length = ediameter3;
  var island_cache = [];
  island_cache.length = ediameter3;
  var air_block_type = null;

  const px = location.x|0;
  const py = location.y|0;
  const pz = location.z|0;

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
               island_cache[bl] = GROUNDED_ISLAND;
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
               if (island_id != GROUNDED_ISLAND)
               {
                 for (var [nbx, nby, nbz, nbl] of neighbor_blocks)
                 {
                   if (island_cache[nbl] == GROUNDED_ISLAND)
                   {
                     island_id = GROUNDED_ISLAND;
                     break;
                   }
                 }
               }
               /*for (var [nbx, nby, nbz, nbl] of neighbor_blocks)
               {
                 var neighbor_is_air = check_if_block_is_air_with_cache(nbx, nby, nbz, nbl, is_air_cache, block_type_cache, dimension);
                 if (!neighbor_is_air)
                 {
                   island_cache[nbl] = island_id;
                 }
               }*/
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
          island_cache[bl] = GROUNDED_ISLAND;
        }
      }
    }
  }

  if (air_block_type)
  {
    var island_id_to_blocks = {};
    for (const [bl, island_id] of Object.entries(island_cache))
    {
      if (island_id != GROUNDED_ISLAND)
      {
        const iz = (bl  % ediameter) - eradius;
        const iy = (((bl - iz - eradius) % ediameter2) / ediameter) - eradius;
        const ix = ((bl - ((iy + eradius) * ediameter) - iz - eradius) / ediameter2) - eradius;
        const bv = {x:(px+ix)|0, y:(py+iy)|0, z:(pz+iz)|0}; // TODO pack into int to avoid dict alloc?
        if (island_id in island_id_to_blocks)
        {
          island_id_to_blocks[island_id].push([bl, bv]);  
        }
        else
        {
          island_id_to_blocks[island_id] = [[bl, bv]];
        }
      }
    }

    var blocks_moved = false;
    for (const [island_id, blocks] of Object.entries(island_id_to_blocks))
    {
      const blocks_bottom_up = blocks.sort(bottom_up_sort_func);
      for (const [bl, bv] of blocks_bottom_up)
      {
        const block_below = {x:bv.x|0, y:(bv.y-1)|0, z:bv.z|0};
        const block_above_label = bl + ediameter;
        var block_type = block_type_cache[bl];
        if (block_type)
        {
          dimension.fillBlocks(new BlockVolume(block_below, block_below), block_type, null);
          blocks_moved = true;
          if (island_cache[block_above_label] != island_id)
          {
            dimension.fillBlocks(new BlockVolume(bv, bv), air_block_type, null);
          }
        }
      }
    }

    if (blocks_moved)
    {
      const bl = px+','+(py-1)+','+pz;
      if (!(bl in globalThis.enqueued_passes_details))
      {
        globalThis.enqueued_passes_details[bl] = [dimension, {x: px, y:(py-1), z:pz}];
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
    if (evt.sender.playerPermissionLevel == 2) // Operator
    {
      globalThis.gravity_enabled = !globalThis.gravity_enabled;
      world.sendMessage('Gravity is now ' + (globalThis.gravity_enabled ? 'enabled' : 'disabled'));
    }
  }
  else if (sp[0] == '!gravr')
  {
    if (evt.sender.playerPermissionLevel == 2) // Operator
    {
      var new_radius = (sp[1]|0) || DEFAULT_RADIUS;
      globalThis.radius = new_radius;
      world.sendMessage('Gravity pass radius is now ' + new_radius);
    }
  }
  else if (sp[0] == '!grava')
  {
    if (evt.sender.playerPermissionLevel == 2) // Operator
    {
      var new_alignment_factor = (sp[1]|0) || DEFAULT_ALIGNMENT_FACTOR;
      globalThis.alignment_factor = new_alignment_factor;
      world.sendMessage('Gravity pass alignment factor is now ' + new_alignment_factor);
    }
  }
  else if (evt.message == '!gravq')
  {
    world.sendMessage('Gravity pass queue length is ' + globalThis.ordered_enqueued_passes.length);
  }
});

const enque_block_event_coords_for_pass_if_not_already_in_queue = function(evt)
{
  const alignment_factor = globalThis.alignment_factor;
  const new_location = evt.block.location;

  var bx = new_location.x;
  bx -= (bx % alignment_factor);
  var by = new_location.y;
  by -= (by % alignment_factor);
  var bz = new_location.z;
  bz -= (bz % alignment_factor);
  const bl = bx+','+by+','+bz;

  if (!(bl in globalThis.enqueued_passes_details))
  {
    globalThis.enqueued_passes_details[bl] = [evt.dimension, {x:bx, y:by, z:bz}];
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
