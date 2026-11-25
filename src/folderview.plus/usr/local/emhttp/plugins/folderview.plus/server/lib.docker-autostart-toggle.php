<?php
function setDockerStartOrderAutostart(string $name, bool $enabled): array {
    return withConfigMutationLock(static function () use ($name, $enabled): array {
        if (!dockerStartOrderIsManaged()) {
            throw new FVPlusConfigConflictException('Unraid owns the start order.');
        }
        $lock = @fopen(dockerSyncOrderLockPath(), 'c+');
        if (!is_resource($lock)) {
            throw new FVPlusConfigConflictException('Docker start order sync failed');
        }
        try {
            if (!@flock($lock, LOCK_EX | LOCK_NB)) {
                throw new FVPlusConfigConflictException('Docker start order sync failed');
            }
            $inventory = fvplusReadRepairInventory('docker');
            if (!array_key_exists($name, $inventory)) {
                fvplusRuntimeInventoryFailure();
            }
            $context = buildDockerStartOrderContext($inventory);
            $original = $context['autoStartContent'];
            if ($original === null) {
                throw new FVPlusConfigConflictException('Docker start order sync failed');
            }
            $lines = preg_split('/(?<=\n)/', $original, -1, PREG_SPLIT_NO_EMPTY) ?: [];
            $lineName = static fn(string $line): string => preg_split('/\s+/', trim($line), 2)[0] ?? '';
            $wasEnabled = isset($context['autoStartMap'][$name]);
            if ($enabled === $wasEnabled) {
                if (writeDockerStartOrderChanges($context, $original, $context['batchWaitOwnership']) !== null) {
                    throw new FVPlusConfigConflictException('Docker start order sync failed');
                }
                return ['enabled' => $enabled];
            }
            $priorPlan = buildDockerStartOrderPlan($context);
            $originalContext = $context;
            if ($enabled) {
                $context['autoStartMap'][$name] = $name;
            } else {
                unset($context['autoStartMap'][$name]);
            }
            $plan = buildDockerStartOrderPlan($context);
            if ($enabled) {
                $rank = array_search($name, $plan['autostartOrder'], true);
                $remaining = $rank === false ? [] : array_slice($plan['autostartOrder'], $rank + 1);
                $following = array_fill_keys($remaining, true);
                $index = count($lines);
                foreach ($lines as $position => $line) {
                    if (isset($following[$lineName($line)])) {
                        $index = $position;
                        break;
                    }
                }
                if ($index > 0 && !str_ends_with($lines[$index - 1], "\n")) {
                    $lines[$index - 1] .= "\n";
                }
                array_splice($lines, $index, 0, [$name . "\n"]);
            } else {
                $lines = array_filter($lines, static fn(string $line): bool => $lineName($line) !== $name);
            }

            $ownership = $context['batchWaitOwnership'];
            $affected = dockerAutostartToggleWaitScope($name, $priorPlan, $plan, $ownership);
            $reconciled = applyDockerStartOrderSequenceWaits($lines, $plan['sequence'], $ownership, $affected);
            if (writeDockerStartOrderChanges($originalContext, implode('', $reconciled['lines']), $reconciled['ownership']) !== null) {
                throw new FVPlusConfigConflictException('Docker start order sync failed');
            }
            return ['enabled' => $enabled];
        } finally {
            fclose($lock);
        }
    });
}
