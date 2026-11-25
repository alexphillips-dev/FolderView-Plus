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
            $path = $context['autoStartFile'];
            $original = $context['autoStartContent'];
            if ($original === null) {
                throw new FVPlusConfigConflictException('Docker start order sync failed');
            }
            $lines = preg_split('/(?<=\n)/', $original, -1, PREG_SPLIT_NO_EMPTY) ?: [];
            $lineName = static fn(string $line): string => preg_split('/\s+/', trim($line), 2)[0] ?? '';
            if ($enabled && !isset($context['autoStartMap'][$name])) {
                $context['autoStartMap'][$name] = $name;
                $plan = buildDockerStartOrderPlan($context);
                $sequence = array_column($plan['sequence'], null, 'name');
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
                $entry = fvplus_set_autostart_line_delay($name, $sequence[$name]['wait'] ?? 0);
                array_splice($lines, $index, 0, [$entry . "\n"]);
            } elseif (!$enabled) {
                $lines = array_filter($lines, static fn(string $line): bool => $lineName($line) !== $name);
            }
            $next = implode('', $lines);
            clearstatcache(true, $path);
            $current = is_file($path) ? @file_get_contents($path) : '';
            if ($current !== $original) {
                throw new FVPlusConfigConflictException('Docker start order sync failed');
            }
            if ($next !== $original) {
                try {
                    writeDurableFileAtomic($path, $next);
                } catch (Throwable $error) {
                    throw new FVPlusConfigConflictException('Docker start order sync failed');
                }
                if (@file_get_contents($path) !== $next) {
                    throw new FVPlusConfigConflictException('Docker start order sync failed');
                }
            }
            return ['enabled' => $enabled];
        } finally {
            fclose($lock);
        }
    });
}
